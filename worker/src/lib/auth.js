/** Bearer Token 鉴权，行为对齐 server-nestjs 的 JwtAuthGuard（失败 401） */
import { verifyToken } from './jwt.js';
import { ApiError } from './errors.js';

export async function currentUser(request, env) {
    const header = request.headers.get('Authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new ApiError('未授权，请登录', 401);
    const payload = await verifyToken(token, env.JWT_SECRET);
    if (!payload || !payload.id) throw new ApiError('登录已过期，请重新登录', 401);
    return { id: payload.id, username: payload.username || '' };
}
