/**
 * 图形验证码
 *
 * 与 NestJS 的差别：那边把答案放在 express-session 里，Worker 没有 session，
 * 因此改成「服务端生成 id + 答案落 D1（1 分钟过期）」，前端带 captchaId 回传。
 * 返回 JSON { id, svg }，前端登录页已做双格式兼容（NestJS 仍返回裸 SVG）。
 */
import { ok } from '../lib/http.js';
import { ApiError } from '../lib/errors.js';
import { first, run, now, uuid, pruneCaptcha } from '../lib/sql.js';

const CHARS = '23456789';       // 与 NestJS 一致：去掉 0/1 这类易混淆字符
const LENGTH = 4;
const TTL = 60_000;

function randomCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
    return Array.from(bytes, b => CHARS[b % CHARS.length]).join('');
}

function randomColor(min, max) {
    const pick = () => min + Math.floor(Math.random() * (max - min));
    return `rgb(${pick(min, max)},${pick(min, max)},${pick(min, max)})`;
}

/** 生成 4 位验证码 SVG（含 2 条干扰线，风格与 svg-captcha 接近） */
function renderSvg(code) {
    const width = 120;
    const height = 40;
    const chars = code.split('').map((char, index) => {
        const x = 12 + index * 26 + Math.random() * 6;
        const y = 28 + (Math.random() * 8 - 4);
        const rotate = Math.random() * 30 - 15;
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="26" font-family="'Comic Sans MS',Verdana,sans-serif" fill="${randomColor(40, 120)}" transform="rotate(${rotate.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${char}</text>`;
    }).join('');

    const lines = Array.from({ length: 2 }, () => {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = Math.random() * width;
        const y2 = Math.random() * height;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${randomColor(120, 200)}" stroke-width="1.2"/>`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${randomColor(235, 252)}"/>${lines}${chars}</svg>`;
}

export async function handleCaptcha(request, env, ctx) {
    if (ctx.method !== 'GET') return null;
    await pruneCaptcha(env);
    const code = randomCode();
    const id = uuid();
    await run(env, 'INSERT INTO captcha (id, text, expire) VALUES (?,?,?)', id, code, now() + TTL);
    return ok({ id, svg: renderSvg(code), expiresIn: TTL / 1000 }, ctx.cors);
}

/** 返回 'ok' | 'expired' | 'wrong' */
export async function checkCaptcha(env, id, text) {
    const answer = String(text || '').trim().toLowerCase();
    if (!id || !answer) return 'expired';
    const row = await first(env, 'SELECT text, expire FROM captcha WHERE id = ?', String(id));
    if (!row) return 'expired';
    if (Number(row.expire) < now()) {
        await run(env, 'DELETE FROM captcha WHERE id = ?', String(id));
        return 'expired';
    }
    if (String(row.text).toLowerCase() !== answer) return 'wrong';
    /* 与 NestJS 的 session 行为一致：有效期内可重复校验（60 秒），过期或生成新码即失效 */
    return 'ok';
}

/** 登录/注册前的统一校验；REQUIRE_CAPTCHA=false 时跳过（仅调试用） */
export async function assertCaptcha(env, body) {
    if (String(env.REQUIRE_CAPTCHA || 'true') !== 'true') return;
    const result = await checkCaptcha(env, body?.captchaId, body?.captcha);
    if (result === 'ok') return;
    if (result === 'wrong') throw new ApiError('Incorrect captcha', 400);
    throw new ApiError('Invalid or expired captcha', 400);
}
