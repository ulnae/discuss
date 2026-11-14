/** Bearer Token 鉴权，行为对齐 server-nestjs 的 JwtAuthGuard（失败 401） */
import { verifyToken } from './jwt.js';
import { ApiError } from './errors.js';

/**
 * 校验 token 并确认账号仍然有效。
 *
 * 只验签是不够的：JWT 是自包含的，账号被注销/软删后签名依然合法，
 * 旧 token 还能继续用满 24 小时。这里补一次主键查询（D1 按主键取一行，成本很低）。
 */
export async function currentUser(request, env) {
    const header = request.headers.get('Authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new ApiError('未授权，请登录', 401);
    const payload = await verifyToken(token, env.JWT_SECRET);
    /* 短时效的 WS ticket 不能当 REST token 用 */
    if (!payload || !payload.id || payload.typ === 'ws-ticket') throw new ApiError('登录已过期，请重新登录', 401);

    let row;
    try {
        row = await env.DB.prepare('SELECT id, username, isDeleted FROM user WHERE id = ?').bind(payload.id).first();
    } catch {
        /* 表尚未初始化（首次部署）时不做账号校验，让具体接口自己暴露问题 */
        return { id: payload.id, username: payload.username || '' };
    }
    if (!row) throw new ApiError('账号不存在，请重新登录', 401);
    if (row.isDeleted) throw new ApiError('账号已注销，请重新登录', 401);
    return { id: row.id, username: row.username || payload.username || '' };
}
