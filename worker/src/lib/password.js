/**
 * 密码哈希：PBKDF2-SHA256
 *
 * 为什么不用 bcrypt：Workers 跑不了原生模块，纯 JS 实现（bcryptjs）在免费版
 * 10ms CPU 限制下基本不可用。
 *
 * 存储格式：pbkdf2$<iterations>$<saltBase64>$<hashBase64>
 * 迭代次数写在串里，所以以后调高 PBKDF2_ITERATIONS 不会让历史密码失效。
 */
import { bytesToBase64, base64ToBytes, safeEqual } from './bytes.js';

const encoder = new TextEncoder();

async function derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        key,
        256
    );
    return new Uint8Array(bits);
}

export function iterationsOf(env) {
    const value = parseInt(env.PBKDF2_ITERATIONS || '10000', 10);
    return Number.isFinite(value) && value >= 1000 ? value : 10000;
}

export async function hashPassword(password, iterations = 10000) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, iterations);
    return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function verifyPassword(password, stored) {
    const parts = String(stored || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations < 1000) return false;
    const hash = await derive(password, base64ToBytes(parts[2]), iterations);
    return safeEqual(bytesToBase64(hash), parts[3]);
}
