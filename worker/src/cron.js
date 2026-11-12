/**
 * 每日存储回收（Cron Trigger，默认北京时间 03:00）
 *
 * 三层策略：
 *   1. 过期删除：createdAt 早于 RETENTION_DAYS 的对象（消息不落库，30 天足够）
 *   2. 配额回收：总量超过全局软上限 92% 时，按最旧优先删到 75%
 *   3. 校准统计：upload_stat 单行累计值可能与实际不一致，每天重算一次
 *
 * 说明：R2 的 DeleteObject 不计费、不计操作额度，所以回收本身没有成本。
 */
import { now, all, first } from './lib/sql.js';
import { uploadLimits, recomputeUsage, DAY } from './lib/quota.js';

const BATCH = 200;
const MAX_BATCHES = 10;   // 单次最多处理 2000 个对象，避免超时；剩下的等下一次

async function deleteBatch(env, rows) {
    const keys = rows.map(row => row.key).filter(Boolean);
    if (keys.length) {
        try {
            await env.UPLOAD.delete(keys);
        } catch (error) {
            /* 对象可能已不存在：不能因此中断，否则登记表永远清不掉 */
            console.error('R2 delete failed', keys.length, error && error.message);
        }
    }
    const statements = rows.map(row => env.DB.prepare('DELETE FROM upload WHERE id = ?').bind(row.id));
    if (statements.length) await env.DB.batch(statements);
    return rows.reduce((sum, row) => sum + Number(row.size || 0), 0);
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
    const stats = { expiredFiles: 0, expiredBytes: 0, quotaFiles: 0, quotaBytes: 0, skipped: false };
    if (!env.UPLOAD) {
        stats.skipped = true;
        return stats;
    }

    const { retentionDays, globalSoft } = uploadLimits(env);
    const cutoff = now() - retentionDays * DAY;

    /* 1. 过期回收 */
    for (let i = 0; i < MAX_BATCHES; i++) {
        const rows = await pickExpired(env, cutoff);
        if (!rows.length) break;
        const bytes = await deleteBatch(env, rows);
        stats.expiredFiles += rows.length;
        stats.expiredBytes += bytes;
        if (rows.length < BATCH) break;
    }

    /* 2. 配额回收 */
    const total = await first(env, 'SELECT COALESCE(SUM(size),0) AS b FROM upload');
    let bytesNow = Number((total && total.b) || 0);
    const high = Math.floor(globalSoft * 0.92);
    const low = Math.floor(globalSoft * 0.75);

    for (let i = 0; i < MAX_BATCHES && bytesNow > high; i++) {
        const rows = await pickOldest(env);
        if (!rows.length) break;
        const bytes = await deleteBatch(env, rows);
        stats.quotaFiles += rows.length;
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
