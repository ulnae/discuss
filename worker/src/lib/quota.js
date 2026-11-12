/**
 * 存储配额：常量、阈值判断与统计读写
 *
 * 设计依据见 ../README.md「文件上传与免费额度」：
 *   Workers KV 免费 1 GB / 1000 写/天 / 10 万读/天 / 单值 25MiB，且不需要绑卡
 *   全局软上限取 900 MB（留 10% 余量），过期由 KV 的 expirationTtl 自动删除
 *   消息不落库，服务端无法判断图片是否还被引用 → 只能按「时间 + 总量」回收
 */

export const MB = 1024 * 1024;
export const GB = 1024 * MB;
export const DAY = 24 * 60 * 60 * 1000;

const int = (value, fallback) => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** 阈值（占比基于全局软上限） */
export const WARN_RATIO = 0.70;     // 只记录告警
export const REJECT_RATIO = 0.85;   // 拒绝新图片
export const FULL_RATIO = 0.95;     // 拒绝所有上传 + 强制回收

export function uploadLimits(env = {}) {
    return {
        maxImage: int(env.UPLOAD_MAX_BYTES, 2 * MB),
        maxDoc: int(env.UPLOAD_MAX_DOC_BYTES, 5 * MB),
        userTotal: int(env.QUOTA_USER_BYTES, 64 * MB),
        userDailyBytes: int(env.QUOTA_USER_DAILY_BYTES, 15 * MB),
        userDailyCount: int(env.QUOTA_USER_DAILY_COUNT, 20),
        globalDailyCount: int(env.QUOTA_GLOBAL_DAILY_COUNT, 800),
        globalSoft: int(env.QUOTA_GLOBAL_BYTES, 900 * MB),
        retentionDays: int(env.RETENTION_DAYS, 30)
    };
}

/** 全局用量：优先读单行累计值，缺失时回落到 SUM */
export async function storageUsage(env) {
    const { globalSoft } = uploadLimits(env);
    let row = null;
    try {
        row = await env.DB.prepare('SELECT bytes, files FROM upload_stat WHERE id = 1').first();
    } catch {
        row = null;
    }
    if (!row) {
        row = await env.DB.prepare('SELECT COALESCE(SUM(size),0) AS bytes, COUNT(*) AS files FROM upload').first();
    }
    const bytes = Number((row && row.bytes) || 0);
    const files = Number((row && row.files) || 0);
    return {
        bytes,
        files,
        quota: globalSoft,
        ratio: globalSoft > 0 ? bytes / globalSoft : 0
    };
}

/** 写回累计值（上传后 +size，回收后整体重算） */
export async function addUsage(env, size) {
    await env.DB.prepare(
        'UPDATE upload_stat SET bytes = bytes + ?, files = files + 1, updatedAt = ? WHERE id = 1'
    ).bind(Number(size) || 0, Date.now()).run();
}

export async function recomputeUsage(env) {
    const row = await env.DB.prepare(
        'SELECT COALESCE(SUM(size),0) AS bytes, COUNT(*) AS files FROM upload'
    ).first();
    await env.DB.prepare(
        'UPDATE upload_stat SET bytes = ?, files = ?, updatedAt = ? WHERE id = 1'
    ).bind(Number((row && row.bytes) || 0), Number((row && row.files) || 0), Date.now()).run();
    return row;
}

export function fmtMB(bytes) {
    const mb = bytes / MB;
    return mb >= 1 ? `${Math.round(mb)}MB` : `${Math.round(bytes / 1024)}KB`;
}

export function fmtGB(bytes) {
    return `${(bytes / GB).toFixed(1)}GB`;
}
