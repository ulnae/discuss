/** Base64 / 字节数组工具：Node 的 Buffer 在 Worker 里用 btoa/atob 代替 */

const CHUNK = 0x8000;

export function bytesToBase64(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < arr.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

export function base64ToBytes(str) {
    const binary = atob(String(str || ''));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

export function bytesToBase64Url(bytes) {
    return bytesToBase64(bytes).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64UrlToBytes(str) {
    const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    return base64ToBytes(s + pad);
}

/** 定长比较，避免哈希比较的时序泄漏 */
export function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
