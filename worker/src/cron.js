/**
 * 每日存储回收（Cron Trigger，默认北京时间 03:00）
 *
 * 三层策略：
 *   1. 过期删除：createdAt 早于 RETENTION_DAYS 的记录，只清 D1 登记表。
 *      对象本身在上传时已带 expirationTtl，到期由 KV 自动删除，
 *      因此不消耗免费版每天 1000 次的 delete 额度。
 *   2. 配额回收：总量超过全局软上限 92% 时，按最旧优先删到 75%。
 *      这一步必须真删 KV（提前回收，等不到 TTL），所以限制单次最多 300 个，
 *      避免一次性打满 delete 额度、影响用户主动删除和后续上传。
 *   3. 校准统计：upload_stat 单行累计值可能与实际不一致，每天重算一次。
 *
 * 说明：为什么不用「KV 自动过期 + 不登记」？因为配额需要知道「当前占用多少」，
 * 只有 D1 里留一份体积记录才能在每次上传前做水位判断。
 */
import { now, all, first, pruneCaptcha } from './lib/sql.js';
import { uploadLimits, recomputeUsage, DAY } from './lib/quota.js';

const BATCH = 200;
const MAX_BATCHES = 10;      // 单次最多处理 2000 条登记，避免超时；剩下的等下一次
const MAX_DELETES = 300;     // 每日 1000 次 delete 额度，回收最多用 300 次
const CONCURRENCY = 25;      // KV 对「不同 key」的删除没有速率限制，但并发别太猛

/** 只删 D1 登记行（对象交给 KV 的 TTL 处理） */
async function forgetRows(env, rows) {
    const statements = rows.map(row => env.DB.prepare('DELETE FROM upload WHERE id = ?').bind(row.id));
    if (statements.length) await env.DB.batch(statements);
    return rows.reduce((sum, row) => sum + Number(row.size || 0), 0);
}

/** 真删 KV 对象，返回成功删除的个数 */
async function deleteObjects(env, keys) {
    let deleted = 0;
    for (let i = 0; i < keys.length; i += CONCURRENCY) {
        const chunk = keys.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(key =>
            env.UPLOAD.delete(key).then(() => true).catch(error => {
                /* 对象可能已过期不存在：不能因此中断，否则登记表永远清不掉 */
                console.error('KV delete failed', key, error && error.message);
                return false;
            })
        ));
        deleted += results.filter(Boolean).length;
    }
    return deleted;
}

async function pickExpired(env, cutoff) {
    return all(
        env,
        'SELECT id, key, size FROM upload WHERE createdAt < ? ORDER BY createdAt ASC LIMIT ?',
        cutoff, BATCH
    );
}

async function pickOldest(env) {
    return all(env, 'SELECT id, key, size FROM upload ORDER BY createdAt ASC LIMIT ?', BATCH);
}

export async function cleanupStorage(env) {
    const stats = {
        expiredFiles: 0, expiredBytes: 0,
        quotaFiles: 0, quotaBytes: 0,
        deletes: 0, skipped: false
    };

    /* 0. 验证码过期行兜底清理：生成验证码时是惰性清理（依赖下一次请求触发），
          低流量期间过期行会一直残留，这里每天兜底清一次（D1 删除不占 KV 额度） */
    await pruneCaptcha(env);

    /* 0.5 软删数据物理清理：90 天以上的 isDeleted 行直接删掉，
           控制表体积与 D1 行读成本（member/friend 无 updatedAt，按 createdAt 判断） */
    try {
        const staleCutoff = now() - 90 * DAY;
        await env.DB.batch([
            env.DB.prepare('DELETE FROM member WHERE isDeleted = 1 AND createdAt < ?').bind(staleCutoff),
            env.DB.prepare('DELETE FROM friend WHERE isDeleted = 1 AND createdAt < ?').bind(staleCutoff),
            env.DB.prepare('DELETE FROM apply WHERE isDeleted = 1 AND updatedAt < ?').bind(staleCutoff)
        ]);
    } catch (error) {
        console.error('soft-deleted rows cleanup failed', error && error.message);
    }

    if (!env.UPLOAD || typeof env.UPLOAD.delete !== 'function') {
        stats.skipped = true;
        return stats;
    }

    const { retentionDays, globalSoft } = uploadLimits(env);
    const cutoff = now() - retentionDays * DAY;

    /* 1. 过期回收：只清登记，不删 KV（TTL 已负责） */
    for (let i = 0; i < MAX_BATCHES; i++) {
        const rows = await pickExpired(env, cutoff);
        if (!rows.length) break;
        const bytes = await forgetRows(env, rows);
        stats.expiredFiles += rows.length;
        stats.expiredBytes += bytes;
        if (rows.length < BATCH) break;
    }

    /* 2. 配额回收：真删 KV，受 delete 额度保护 */
    const total = await first(env, 'SELECT COALESCE(SUM(size),0) AS b FROM upload');
    let bytesNow = Number((total && total.b) || 0);
    const high = Math.floor(globalSoft * 0.92);
    const low = Math.floor(globalSoft * 0.75);
    let deletesLeft = MAX_DELETES;

    for (let i = 0; i < MAX_BATCHES && bytesNow > high && deletesLeft > 0; i++) {
        const rows = await pickOldest(env);
        if (!rows.length) break;

        const picked = rows.slice(0, deletesLeft);
        const deleted = await deleteObjects(env, picked.map(row => row.key).filter(Boolean));
        stats.deletes += deleted;
        deletesLeft -= picked.length;

        const bytes = await forgetRows(env, picked);
        stats.quotaFiles += picked.length;
        stats.quotaBytes += bytes;
        bytesNow -= bytes;
        if (rows.length < BATCH) break;
    }

    /* 3. 校准累计值 */
    const row = await recomputeUsage(env);
    stats.totalBytes = Number((row && row.bytes) || 0);
    stats.totalFiles = Number((row && row.files) || 0);
    stats.ratio = globalSoft > 0 ? Number((stats.totalBytes / globalSoft).toFixed(3)) : 0;
    return stats;
}
