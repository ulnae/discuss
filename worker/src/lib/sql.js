/** D1 查询与字段序列化的薄封装 */

export const now = () => Date.now();
export const uuid = () => crypto.randomUUID();

/** 毫秒 → ISO 字符串（TypeORM 的 timestamp 就是这么序列化的） */
export function iso(ms) {
    if (ms == null || ms === '') return null;
    const date = new Date(Number(ms));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const bool = (value) => !!value;
export const bit = (value) => (value ? 1 : 0);

export async function first(env, sql, ...args) {
    return env.DB.prepare(sql).bind(...args).first();
}

export async function all(env, sql, ...args) {
    const { results } = await env.DB.prepare(sql).bind(...args).all();
    return results || [];
}

export async function run(env, sql, ...args) {
    return env.DB.prepare(sql).bind(...args).run();
}

export async function count(env, sql, ...args) {
    const row = await first(env, sql, ...args);
    if (!row) return 0;
    return Number(row.total || row.count || Object.values(row)[0] || 0);
}

/** 便于批量清理过期验证码（每次生成时顺手清一次，避免表无限增长） */
export async function pruneCaptcha(env) {
    try {
        await run(env, 'DELETE FROM captcha WHERE expire < ?', now());
    } catch {
        /* 清理失败不影响主流程 */
    }
}
