/**
 * 实时通话 —— Cloudflare Realtime TURN 凭证下发
 *
 *   GET /api/rtc/ice   返回可直接塞进 RTCPeerConnection 的 iceServers
 *
 * 为什么要服务端代发：TURN Key 的 API Token 是长期密钥，一旦进浏览器就等于公开，
 * 任何人都能拿它刷流量。这里用长期密钥换短期凭证（默认 1 小时），只把
 * username/credential 交给前端。
 *
 * 未配置 TURN_KEY_ID / TURN_KEY_API_TOKEN 时降级为 Cloudflare 免费 STUN：
 * 局域网内仍可直连，跨网络会连不上，但不会让通话流程直接报错。
 * 免费额度：TURN 每月前 1000 GB 出向流量免费，STUN 不限量。
 */
import { ok } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';

/** 短期凭证有效期（秒）。前端只在通话建立前取一次，1 小时足够 */
const TTL = 3600;
/**
 * 三层兜底：STUN 永远保留（免费不限量、国内可达）；
 * openrelay 公共 TURN 是跨严格 NAT 的第二道保险（凭证公开、无 SLA，
 * 连不通时 ICE 会自动放弃 relay 候选，不会比只有 STUN 更差）。
 * 只放 :80 UDP 和 :443 TCP 两条，减少无效候选、加快 ICE 收敛。
 */
const FALLBACK_ICE_SERVERS = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
        urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];
const CACHE_TTL = 5 * 60 * 1000;

/** 同一 isolate 内复用 5 分钟，避免每次拨号都打一次 Cloudflare API */
let cache = { at: 0, iceServers: null };

export async function handleRtc(request, env, ctx, rest) {
    if (rest.length || ctx.method !== 'GET') return null;
    /* 必须登录：凭证虽然是短期的，也不该给匿名请求刷 */
    await currentUser(request, env);

    const keyId = String(env.TURN_KEY_ID || '').trim();
    const apiToken = String(env.TURN_KEY_API_TOKEN || '').trim();
    if (!keyId || !apiToken) return ok({ iceServers: FALLBACK_ICE_SERVERS, turn: false }, ctx.cors);

    if (cache.iceServers && Date.now() - cache.at < CACHE_TTL) {
        return ok({ iceServers: cache.iceServers, turn: true, cached: true }, ctx.cors);
    }

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

        cache = { at: Date.now(), iceServers };
        return ok({ iceServers, turn: true, ttl: TTL }, ctx.cors);
    } catch (error) {
        /* 拿不到凭证时降级 STUN，而不是让整通电话起不来 */
        console.error('turn credential failed', error && error.message);
        return ok({ iceServers: FALLBACK_ICE_SERVERS, turn: false }, ctx.cors);
    }
}
