/**
 * HTTP 工具：统一响应结构、CORS、请求体解析
 *
 * 响应结构与 server-nestjs 完全一致：
 *   成功 { code: 200, msg: 'success', data: <payload> }
 *   失败 { code: -1,  data: null,       msg: <错误信息> }
 * 前端 axios 拦截器依靠这套结构判断结果，不能改。
 */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function ok(data, cors = {}) {
    return json({ code: 200, msg: 'success', data }, 200, cors);
}

export function fail(msg, status = 400, cors = {}) {
    return json({ code: -1, msg, data: null }, status, cors);
}

/** ALLOW_ORIGIN 支持逗号分隔多个来源 */
export function corsFor(request, env) {
    const allow = String(env.ALLOW_ORIGIN || '*');
    const origin = request.headers.get('Origin') || '';
    if (allow === '*') return { 'Access-Control-Allow-Origin': '*' };
    const list = allow.split(',').map(s => s.trim()).filter(Boolean);
    if (list.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            Vary: 'Origin'
        };
    }
    return { Vary: 'Origin' };   /* 来源不符：不带 ACAO，由浏览器拦截 */
}

export function preflight(request, env) {
    return new Response(null, {
        status: 204,
        headers: {
            ...corsFor(request, env),
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,Base-Version,x-csrf-token',
            'Access-Control-Expose-Headers': 'X-Captcha-Id',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function readJson(request) {
    try { return await request.json(); } catch { return null; }
}

export function searchParams(url) {
    return url.searchParams;
}

/** 统一分页参数：NestJS 默认 page=1 / pageSize=10，这里额外做上限保护 */
export function pageOf(query, defaultSize = 10, maxSize = 100) {
    const page = Math.max(1, parseInt(query.get('page') || '1', 10) || 1);
    let pageSize = parseInt(query.get('pageSize') || String(defaultSize), 10) || defaultSize;
    pageSize = Math.min(Math.max(1, pageSize), maxSize);
    return { page, pageSize, offset: (page - 1) * pageSize };
}
