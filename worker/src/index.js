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
import { verifyToken, signToken } from './lib/jwt.js';
import { currentUser } from './lib/auth.js';
import { EVENTS } from './lib/events.js';
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
                    /* 优先读 cron 每日写入的统计快照（KV 读不计费额度高），
                       避免探活请求每次都触发 D1 聚合扫描 */
                    const cached = await env.UPLOAD.get('stats:storage');
                    if (cached) {
                        const s = JSON.parse(cached);
                        storage = {
                            usedBytes: s.bytes,
                            files: s.files,
                            quotaBytes: s.quotaBytes,
                            percent: s.percent
                        };
                    } else {
                        const usage = await storageUsage(env);
                        storage = {
                            usedBytes: usage.bytes,
                            files: usage.files,
                            quotaBytes: usage.quota,
                            percent: Number((usage.ratio * 100).toFixed(1))
                        };
                    }
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
                case 'ws': return await handleSocket(request, env, rc, rest);
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
                .then(async stats => {
                    console.log('storage cleanup', JSON.stringify(stats));
                    /* 把存储统计快照写入 KV，供 /api/health 直接读取（读 KV 便宜，D1 聚合贵） */
                    try {
                        await env.UPLOAD.put('stats:storage', JSON.stringify({
                            bytes: stats.totalBytes || 0,
                            files: stats.totalFiles || 0,
                            quotaBytes: Number(env.QUOTA_GLOBAL_BYTES || 0),
                            percent: stats.ratio != null ? Number((stats.ratio * 100).toFixed(1)) : 0,
                            updatedAt: Date.now()
                        }));
                    } catch (error) {
                        console.error('stats snapshot failed', error && error.message);
                    }
                })
                .catch(error => console.error('storage cleanup failed', error && error.message))
        );
    }
};

/**
 * POST /api/alert —— 向所有在线用户广播系统通知（对应 NestJS 的 AlertController）
 *
 * 这是「一人发、全员收」的广播口，必须鉴权：以前裸奔时任何匿名请求都能给全站弹窗。
 * 采用共享密钥（`wrangler secret put ALERT_SECRET`）+ `x-alert-secret` 头，
 * 未配置密钥时直接关闭该接口（拒绝优先，而不是默认放行）。
 */
async function handleAlert(request, env, rc, rest) {
    if (rc.method !== 'POST' || rest.length) return null;

    const secret = String(env.ALERT_SECRET || '');
    if (!secret) return fail('系统广播未启用：请先配置 ALERT_SECRET', 403, rc.cors);
    const provided = request.headers.get('x-alert-secret') || '';
    if (provided !== secret) return fail('无权发送系统广播', 403, rc.cors);

    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const message = String((body && body.message) || '').trim();
    if (!message) return fail('缺少 message', 400, rc.cors);

    const sender = String((body && body.sender) || '').trim();

    const stub = env.HUB.get(env.HUB.idFromName('hub'));
    const result = await stub.fetch('https://hub/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: EVENTS.SYSTEM_ALERT,
            data: { senderName: sender || '系统通知', message, timestamp: Date.now() }
        })
    });
    const stats = await result.json().catch(() => ({ delivered: 0 }));
    return ok({ delivered: stats.delivered || 0 }, rc.cors);
}

/**
 * GET /api/ws/ticket —— 换取 60 秒一次性 WebSocket 连接凭证。
 * WS 握手不再携带长期 JWT（token 会进边缘访问日志），改为短时效 ticket。
 */
async function handleWsTicket(request, env, rc) {
    if (rc.method !== 'GET') return null;
    const me = await currentUser(request, env);
    const ticket = await signToken(
        { id: me.id, username: me.username, typ: 'ws-ticket' },
        env.JWT_SECRET,
        '60s'
    );
    return ok({ ticket }, rc.cors);
}

/**
 * GET /api/ws?token=<jwt|ticket> —— 把连接转发给 Durable Object。
 * 浏览器 WebSocket 不能自定义请求头，所以凭证走 query；
 * 推荐流程：先 GET /api/ws/ticket 拿 60 秒短票，再用短票连接。
 */
async function handleSocket(request, env, rc, rest) {
    /* /api/ws/ticket：签发短时效连接凭证 */
    if (rest[0] === 'ticket') return await handleWsTicket(request, env, rc);

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
