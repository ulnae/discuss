/**
 * 实时通话 —— TURN 凭证下发（多层供应商，自动降级）
 *
 *   GET /api/rtc/ice   返回可直接塞进 RTCPeerConnection 的 iceServers
 *
 * 为什么要服务端代发：TURN 供应商的长期密钥一旦进浏览器就等于公开，
 * 任何人都能拿它刷流量。这里用长期密钥换短期凭证，只把 username/credential 交给前端。
 *
 * 供应商优先级：
 *   1. Cloudflare Realtime TURN（TURN_KEY_ID + TURN_KEY_API_TOKEN，需绑卡，1000GB/月免费）
 *   2. Metered Open Relay（METERED_APP_NAME + METERED_API_KEY，注册免费账号即可，无需绑卡，20GB/月）
 *   3. Cloudflare STUN 兜底（免费不限量、国内可达；只能打洞，不能中继）
 *
 * 历史备注：曾用 openrelay.metered.ca 静态凭证（openrelayproject）作兜底，
 * 2026-10 该公共账号已被 Metered 停用（域名解析到不可路由的 192.0.2.1），移除。
 */
import { ok } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';

/** 短期凭证有效期（秒）。前端只在通话建立前取一次，1 小时足够 */
const TTL = 3600;
/** 最终兜底：只有 STUN，跨严格 NAT 无法中继但保证流程不报错 */
const STUN_ONLY = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const CACHE_TTL = 5 * 60 * 1000;

/** 同一 isolate 内复用 5 分钟，避免每次拨号都打一次供应商 API */
let cache = { at: 0, iceServers: null, turn: false };

export async function handleRtc(request, env, ctx, rest) {
    /* 路由 /api/rtc/ice：rest = ['ice'] */
    if (ctx.method !== 'GET' || rest[0] !== 'ice' || rest.length !== 1) return null;
    /* 必须登录：凭证虽然是短期的，也不该给匿名请求刷 */
    await currentUser(request, env);

    if (cache.iceServers && Date.now() - cache.at < CACHE_TTL) {
        return ok({ iceServers: cache.iceServers, turn: cache.turn, cached: true }, ctx.cors);
    }

    /* 1. Cloudflare Realtime TURN */
    const keyId = String(env.TURN_KEY_ID || '').trim();
    const apiToken = String(env.TURN_KEY_API_TOKEN || '').trim();
    if (keyId && apiToken) {
        try {
            const res = await fetch(
                `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ttl: TTL })
                }
            );
            if (!res.ok) throw new Error(`cloudflare turn ${res.status}`);
            const data = await res.json();
            const iceServers = Array.isArray(data && data.iceServers) ? data.iceServers : null;
            if (!iceServers || !iceServers.length) throw new Error('empty iceServers');

            cache = { at: Date.now(), iceServers, turn: true };
            return ok({ iceServers, turn: true, ttl: TTL, provider: 'cloudflare' }, ctx.cors);
        } catch (error) {
            console.error('cloudflare turn credential failed', error && error.message);
        }
    }

    /* 2. Metered Open Relay（免费账号，无需绑卡） */
    const meteredApp = String(env.METERED_APP_NAME || '').trim();
    const meteredKey = String(env.METERED_API_KEY || '').trim();
    if (meteredApp && meteredKey) {
        try {
            const res = await fetch(
                `https://${encodeURIComponent(meteredApp)}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredKey)}`,
                { method: 'GET' }
            );
            if (!res.ok) throw new Error(`metered turn ${res.status}`);
            const data = await res.json();
            const iceServers = Array.isArray(data && data.iceServers) ? data.iceServers : null;
            if (!iceServers || !iceServers.length) throw new Error('empty iceServers');

            cache = { at: Date.now(), iceServers, turn: true };
            return ok({ iceServers, turn: true, provider: 'metered' }, ctx.cors);
        } catch (error) {
            console.error('metered turn credential failed', error && error.message);
        }
    }

    /* 3. STUN 兜底，而不是让整通电话起不来 */
    return ok({ iceServers: STUN_ONLY, turn: false, provider: 'stun' }, ctx.cors);
}
