/**
 * discuss-api —— Cloudflare Worker 入口
 *
 * 目标：接口形状与 server-nestjs 完全对齐，前端不需要为「哪个后端」写两套调用。
 *   统一前缀 /api，成功 { code:200, msg:'success', data }，失败 { code:-1, msg, data:null }
 *
 * 结构：
 *   REST   → src/routes/*.js
 *   实时   → src/durable/hub.js（Durable Object，WebSocket Hibernation）
 *   静态   → /public/<userId>/<file>（Workers KV，可选）
 *
 * 部署见同目录 README.md。
 */
import { corsFor, fail, ok, preflight } from './lib/http.js';
import { ApiError } from './lib/errors.js';
import { verifyToken } from './lib/jwt.js';
import { handleCaptcha } from './routes/captcha.js';
import { handleUser, servePublicFile } from './routes/user.js';
import { handleRoom } from './routes/room.js';
import { handleMember } from './routes/member.js';
import { handleApply } from './routes/apply.js';
import { handleFriend } from './routes/friend.js';
import { storageUsage } from './lib/quota.js';
import { cleanupStorage } from './cron.js';

export { DiscussHub } from './durable/hub.js';

const notFound = () => new ApiError('not found', 404);

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '') || '/';
        const cors = corsFor(request, env);

        if (request.method === 'OPTIONS') return preflight(request, env);

        const rc = { url, path, method: request.method, cors, env };

        try {
            /* 上传后的静态文件：URL 形如 /public/<userId>/<filename> */
            if (path.startsWith('/public/')) {
                return await servePublicFile(request, env, rc, path.slice('/public/'.length));
            }

            if (path === '/' || path === '/api/health') {
                let storage = null;
                try {
                    const usage = await storageUsage(env);
                    storage = {
                        usedBytes: usage.bytes,
                        files: usage.files,
                        quotaBytes: usage.quota,
                        percent: Number((usage.ratio * 100).toFixed(1))
                    };
                } catch {
                    storage = null;   // 表未初始化时不影响存活探测
                }
                return ok({
                    ok: true,
                    service: 'discuss-api',
                    time: Date.now(),
                    colo: (request.cf && request.cf.colo) || '',
                    storage
                }, cors);
            }

            /* 配置自检：没配 JWT_SECRET 时 HMAC 会以空密钥导入并抛出晦涩错误，
               这里提前拦下，返回可直接照做的提示（health 不受影响）。 */
            if (!env.JWT_SECRET) {
                return fail('服务端未配置 JWT_SECRET：请执行 wrangler secret put JWT_SECRET 后重试', 500, cors);
            }

            if (!path.startsWith('/api/')) throw notFound();

            const segments = path.split('/').filter(Boolean);   // ['api', 'user', 'login']
            const group = segments[1] || '';
            const rest = segments.slice(2);

            switch (group) {
                case 'captcha': return (await handleCaptcha(request, env, rc)) || fail('not found', 404, cors);
                case 'user': return (await handleUser(request, env, rc, rest)) || fail('not found', 404, cors);
                case 'room': return (await handleRoom(request, env, rc, rest)) || fail('not found', 404, cors);
                case 'member': return (await handleMember(request, env, rc, rest)) || fail('not found', 404, cors);
                case 'apply': return (await handleApply(request, env, rc, rest)) || fail('not found', 404, cors);
                case 'friend': return (await handleFriend(request, env, rc, rest)) || fail('not found', 404, cors);
                case 'alert': return await handleAlert(request, env, rc, rest);
                case 'ws': return await handleSocket(request, env, rc);
                case 'sse':
                    return fail('SSE 已由 WebSocket 通道取代，请使用 /api/ws', 501, cors);
                default: throw notFound();
            }
        } catch (error) {
            if (error instanceof ApiError) return fail(error.message, error.status, cors);
            console.error(rc.method, path, error);
            return fail('服务内部错误: ' + (error && error.message), 500, cors);
        }
    },

    /** Cron Trigger：每日回收过期/超额文件（见 src/cron.js） */
    async scheduled(event, env, ctx) {
        ctx.waitUntil(
            cleanupStorage(env)
                .then(stats => console.log('storage cleanup', JSON.stringify(stats)))
                .catch(error => console.error('storage cleanup failed', error && error.message))
        );
    }
};

/** POST /api/alert —— 向所有在线用户广播系统通知（对应 NestJS 的 AlertController） */
async function handleAlert(request, env, rc, rest) {
    if (rc.method !== 'POST' || rest.length) return null;

    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const message = String((body && body.message) || '').trim();
    if (!message) return fail('缺少 message', 400, rc.cors);

    let sender = String((body && body.sender) || '').trim();
    const header = request.headers.get('Authorization') || '';
    if (!sender && header.toLowerCase().startsWith('bearer ')) {
        const payload = await verifyToken(header.slice(7).trim(), env.JWT_SECRET);
        if (payload && payload.username) sender = payload.username;
    }

    const stub = env.HUB.get(env.HUB.idFromName('hub'));
    const result = await stub.fetch('https://hub/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'system:alert',
            data: { sender: sender || '系统通知', message, timestamp: Date.now() }
        })
    });
    const stats = await result.json().catch(() => ({ delivered: 0 }));
    return ok({ delivered: stats.delivered || 0 }, rc.cors);
}

/**
 * GET /api/ws?token=<jwt> —— 把连接转发给 Durable Object
 * 浏览器 WebSocket 不能自定义请求头，所以 token 走 query（与 NestJS 的 SSE 做法一致）。
 */
async function handleSocket(request, env, rc) {
    if (request.headers.get('Upgrade') !== 'websocket') {
        return fail('请使用 WebSocket 连接', 426, rc.cors);
    }

    const token = rc.url.searchParams.get('token') || '';
    const payload = await verifyToken(token, env.JWT_SECRET);
    if (!payload || !payload.id) return fail('未授权，请登录', 401, rc.cors);

    const headers = new Headers(request.headers);
    headers.set('x-user-id', payload.id);
    headers.set('x-username', encodeURIComponent(payload.username || ''));

    const stub = env.HUB.get(env.HUB.idFromName('hub'));
    /* 用原 request 复制一份并补上身份头，保留 Upgrade 等握手信息 */
    return stub.fetch(new Request(request, { headers }));
}
