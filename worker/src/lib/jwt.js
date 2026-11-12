/**
 * JWT（HS256）—— 与 server-nestjs 的 @nestjs/jwt 默认签发格式一致，
 * payload 为 { id, username, iat, exp }，所以两边签发的 token 可以互用（只要 JWT_SECRET 相同）。
 */
import { bytesToBase64Url, base64UrlToBytes, safeEqual } from './bytes.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function importKey(secret) {
    const raw = String(secret || '');
    /* WebCrypto 对空密钥的报错是 "Imported HMAC key length (0)..."，对排查毫无帮助 */
    if (!raw) throw new Error('JWT_SECRET 未配置（wrangler secret put JWT_SECRET）');
    return crypto.subtle.importKey('raw', encoder.encode(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** "24h" / "7d" / "3600s" / 3600 → 秒 */
export function parseDuration(value, fallback = 86400) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'number') return value;
    const str = String(value).trim();
    const match = /^(\d+(?:\.\d+)?)\s*([smhd])?$/i.exec(str);
    if (!match) return fallback;
    const num = Number(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    const factor = unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
    return Math.floor(num * factor);
}

export async function signToken(payload, secret, expiresIn = '24h') {
    const now = Math.floor(Date.now() / 1000);
    const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const body = bytesToBase64Url(encoder.encode(JSON.stringify({
        ...payload,
        iat: now,
        exp: now + parseDuration(expiresIn)
    })));
    const data = `${header}.${body}`;
    const signature = await crypto.subtle.sign('HMAC', await importKey(secret), encoder.encode(data));
    return `${data}.${bytesToBase64Url(signature)}`;
}

export async function verifyToken(token, secret) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    try {
        const signingInput = `${parts[0]}.${parts[1]}`;
        const expected = await crypto.subtle.sign('HMAC', await importKey(secret), encoder.encode(signingInput));
        if (!safeEqual(bytesToBase64Url(expected), parts[2])) return null;
        const payload = JSON.parse(decoder.decode(base64UrlToBytes(parts[1])));
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}
