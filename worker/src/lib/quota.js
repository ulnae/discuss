/**
 * 存储配额：常量、阈值判断与统计读写
 *
 * 设计依据见 ../README.md「文件上传与免费额度」：
 *   R2 免费 10 GB-month，留 40% 余量 → 全局软上限 6 GB
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
        maxDoc: int(env.UPLOAD_MAX_DOC_BYTES, 10 * MB),
        userTotal: int(env.QUOTA_USER_BYTES, 128 * MB),
        userDailyBytes: int(env.QUOTA_USER_DAILY_BYTES, 30 * MB),
        userDailyCount: int(env.QUOTA_USER_DAILY_COUNT, 50),
        globalSoft: int(env.QUOTA_GLOBAL_BYTES, 6 * GB),
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
