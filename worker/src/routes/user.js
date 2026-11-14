/**
 * 用户模块 —— 对齐 server-nestjs 的 UserController
 *
 *   POST   /api/user            注册（校验验证码）
 *   POST   /api/user/login      登录（返回 access_token）
 *   GET    /api/user            分页列表（鉴权）
 *   GET    /api/user/search     按用户名搜索（鉴权）
 *   GET    /api/user/:id        详情（鉴权）
 *   PATCH  /api/user/:id        更新（仅本人）
 *   DELETE /api/user/:id        软删除
 *   POST   /api/user/upload     文件上传（Workers KV，未绑定时 501）
 */
import { ApiError, notImplemented } from '../lib/errors.js';
import { ok, readJson, pageOf } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';
import { signToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword, iterationsOf } from '../lib/password.js';
import { all, first, run, now, uuid, iso, count } from '../lib/sql.js';
import {
    uploadLimits, storageUsage, addUsage,
    REJECT_RATIO, FULL_RATIO, fmtMB, DAY
} from '../lib/quota.js';
import { assertCaptcha } from './captcha.js';

export const userView = (row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
});

async function ensureUnique(env, column, value, message) {
    if (!value) return;
    const row = await first(env, `SELECT id FROM user WHERE ${column} = ?`, value);
    if (row) throw new ApiError(message, 409);
}

async function register(request, env, ctx) {
    const body = (await readJson(request)) || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const email = String(body.email || '').trim();
    if (!username || !password) throw new ApiError('用户名和密码不能为空', 400);

    await assertCaptcha(env, body);
    await ensureUnique(env, 'username', username, '用户名已存在');
    await ensureUnique(env, 'email', email, '邮箱已被注册');

    const timestamp = now();
    await run(
        env,
        'INSERT INTO user (id, username, password, email, createdAt, updatedAt, isDeleted) VALUES (?,?,?,?,?,?,0)',
        uuid(), username, await hashPassword(password, iterationsOf(env)), email, timestamp, timestamp
    );
    return ok('创建用户成功', ctx.cors);
}

async function login(request, env, ctx) {
    const body = (await readJson(request)) || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) throw new ApiError('用户名和密码不能为空', 400);

    await assertCaptcha(env, body);

    const row = await first(env, 'SELECT * FROM user WHERE username = ? AND isDeleted = 0', username);
    if (!row) throw new ApiError('用户名或密码错误', 401);
    if (!(await verifyPassword(password, row.password))) throw new ApiError('用户名或密码错误', 401);

    const expiresIn = env.JWT_EXPIRES_IN || '24h';
    const accessToken = await signToken({ id: row.id, username: row.username }, env.JWT_SECRET, expiresIn);
    return ok({
        ...userView(row),
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn
    }, ctx.cors);
}

async function list(request, env, ctx) {
    await currentUser(request, env);
    const { pageSize, offset } = pageOf(ctx.url.searchParams);
    const rows = await all(
        env,
        'SELECT id, username, email, createdAt, updatedAt FROM user WHERE isDeleted = 0 ORDER BY createdAt DESC LIMIT ? OFFSET ?',
        pageSize, offset
    );
    const total = await count(env, 'SELECT COUNT(*) AS total FROM user WHERE isDeleted = 0');
    return ok({ rows: rows.map(userView), total }, ctx.cors);
}

async function search(request, env, ctx) {
    await currentUser(request, env);
    const keyword = ctx.url.searchParams.get('username') || '';
    const rows = await all(
        env,
        'SELECT id, username, email, createdAt, updatedAt FROM user WHERE isDeleted = 0 AND username LIKE ? ORDER BY createdAt DESC',
        `%${keyword}%`
    );
    return ok(rows.map(userView), ctx.cors);
}

async function detail(request, env, ctx, id) {
    await currentUser(request, env);
    const row = await first(env, 'SELECT id, username, email, createdAt, updatedAt FROM user WHERE id = ? AND isDeleted = 0', id);
    if (!row) throw new ApiError('该用户不存在', 404);
    return ok(userView(row), ctx.cors);
}

async function update(request, env, ctx, id) {
    const me = await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const exist = await first(env, 'SELECT * FROM user WHERE id = ? AND isDeleted = 0', id);
    if (!exist) throw new ApiError(`id为${id}的用户不存在`, 404);
    if (me.id !== id) throw new ApiError('您没有权限更新该用户', 403);

    const fields = [];
    const args = [];
    if (body.username) {
        await ensureUnique(env, 'username', String(body.username).trim(), '用户名已存在');
        fields.push('username = ?'); args.push(String(body.username).trim());
    }
    if (body.email) {
        await ensureUnique(env, 'email', String(body.email).trim(), '邮箱已被注册');
        fields.push('email = ?'); args.push(String(body.email).trim());
    }
    if (body.password) {
        fields.push('password = ?'); args.push(await hashPassword(String(body.password), iterationsOf(env)));
    }
    if (fields.length) {
        fields.push('updatedAt = ?'); args.push(now(), id);
        await run(env, `UPDATE user SET ${fields.join(', ')} WHERE id = ?`, ...args);
    }
    return ok('更新用户成功', ctx.cors);
}

async function remove(request, env, ctx, id) {
    const me = await currentUser(request, env);
    const exist = await first(env, 'SELECT id FROM user WHERE id = ? AND isDeleted = 0', id);
    if (!exist) throw new ApiError(`id为${id}的用户不存在`, 404);
    /* 只能注销自己：否则任何登录用户都能把别人的账号软删掉 */
    if (me.id !== id) throw new ApiError('您没有权限删除该用户', 403);
    await run(env, 'UPDATE user SET isDeleted = 1, updatedAt = ? WHERE id = ?', now(), id);
    return ok('删除用户成功', ctx.cors);
}

/**
 * 文件上传：形状与 NestJS multer 版一致
 *   { code:200, message, filename, originalname, size, mimetype, path, userId, uploadTime }
 * 前端把 path 拼成 `${VITE_APP_API_BASE_URL}/${path}` 访问，
 * 所以 path 形如 public/<userId>/<file>，由 /public/* 路由从 KV 读回。
 */
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif']);
const DOC_EXT = new Set([
    '.pdf', '.zip', '.rar', '.7z', '.txt', '.md', '.csv',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.mp3', '.wav', '.mp4', '.webm'
]);

async function upload(request, env, ctx) {
    const me = await currentUser(request, env);
    if (!env.UPLOAD || typeof env.UPLOAD.put !== 'function') {
        throw notImplemented('当前 Worker 未绑定 UPLOAD（KV）存储，文件上传功能未启用');
    }

    const limits = uploadLimits(env);
    const form = await request.formData().catch(() => null);
    const file = form && form.get('file');
    if (!file || typeof file === 'string') throw new ApiError('未选择文件', 400);

    const originalname = file.name || 'file';
    const ext = (originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    const mime = String(file.type || '').toLowerCase();

    /* SVG / HTML 会在同域下执行脚本，直接拒绝；只放行图片与常见文档 */
    if (ext === '.svg' || ext === '.svgz' || mime === 'image/svg+xml' || mime.startsWith('text/html')) {
        throw new ApiError('不支持该文件类型', 415);
    }
    const isImage = IMAGE_EXT.has(ext) || mime.startsWith('image/');
    if (!isImage && !DOC_EXT.has(ext)) throw new ApiError('不支持该文件类型', 415);
    if (!file.size) throw new ApiError('文件内容为空', 400);

    const limit = isImage ? limits.maxImage : limits.maxDoc;
    if (file.size > limit) {
        throw new ApiError(`文件不能超过 ${fmtMB(limit)}`, 400);
    }

    /* 三级水位：85% 起拒图片，95% 起拒绝全部上传（文字消息始终不受影响） */
    const usage = await storageUsage(env);
    if (usage.ratio >= FULL_RATIO) {
        throw new ApiError('存储空间已满，暂时无法上传，文字消息不受影响', 507);
    }
    if (usage.ratio >= REJECT_RATIO && isImage) {
        throw new ApiError('图片存储空间已满，暂时无法发送图片，文字消息不受影响', 507);
    }

    const since = now() - DAY;
    const daily = await first(
        env,
        'SELECT COUNT(*) AS c, COALESCE(SUM(size),0) AS b FROM upload WHERE userId = ? AND createdAt >= ?',
        me.id, since
    );
    if (Number(daily.c) >= limits.userDailyCount) {
        throw new ApiError(`今日上传次数已达上限（${limits.userDailyCount} 次），请明天再试`, 429);
    }
    if (Number(daily.b) + file.size > limits.userDailyBytes) {
        throw new ApiError(`今日上传流量已达上限（${fmtMB(limits.userDailyBytes)}），请明天再试`, 429);
    }

    /* KV 免费版每天只有 1000 次写。全站次数到顶时继续放行会让 KV 直接报错，
       所以这里提前拦下，返回可读提示（文字消息不受影响）。 */
    const globalDaily = await first(
        env,
        'SELECT COUNT(*) AS c FROM upload WHERE createdAt >= ?',
        since
    );
    if (Number(globalDaily.c) >= limits.globalDailyCount) {
        throw new ApiError('今日全站上传次数已达上限，请明天再试，文字消息不受影响', 429);
    }

    const mine = await first(env, 'SELECT COALESCE(SUM(size),0) AS b FROM upload WHERE userId = ?', me.id);
    if (Number(mine.b) + file.size > limits.userTotal) {
        throw new ApiError(`个人存储空间已满（${fmtMB(limits.userTotal)}），旧文件会自动清理`, 507);
    }

    const filename = `${crypto.randomUUID()}${ext}`;
    const key = `${me.id}/${filename}`;
    const contentType = mime || 'application/octet-stream';

    /* Workers KV 写入：
       - 值上限 25MiB，这里最大 5MB，直接整块读入内存
       - metadata 上限 1024 字节，只存响应需要的三个字段
       - expirationTtl 与 RETENTION_DAYS 一致：到期由 KV 自己删除，
         不占用每天 1000 次的 delete 额度，cron 只需清 D1 登记表 */
    try {
        await env.UPLOAD.put(key, await file.arrayBuffer(), {
            metadata: { contentType, size: file.size, disposition: isImage ? 'inline' : 'attachment' },
            expirationTtl: limits.retentionDays * 24 * 60 * 60
        });
    } catch (error) {
        console.error('KV put failed', key, error && error.message);
        throw new ApiError('存储服务暂时不可用，请稍后重试', 503);
    }

    await run(
        env,
        'INSERT INTO upload (id, userId, key, size, mime, createdAt) VALUES (?,?,?,?,?,?)',
        uuid(), me.id, key, file.size, mime || null, now()
    );
    await addUsage(env, file.size);

    const after = await storageUsage(env);
    return ok({
        code: 200,
        message: '文件上传成功',
        filename,
        originalname,
        size: file.size,
        mimetype: mime || 'application/octet-stream',
        path: `public/${key}`,
        userId: me.id,
        uploadTime: Date.now(),
        storage: { used: after.bytes, quota: after.quota, ratio: Number(after.ratio.toFixed(3)) }
    }, ctx.cors);
}

/** /public/<userId>/<filename> → KV（带边缘缓存，避免每次浏览都消耗 KV 读额度） */
export async function servePublicFile(request, env, ctx, key) {
    if (!env.UPLOAD || typeof env.UPLOAD.getWithMetadata !== 'function') {
        throw new ApiError('文件不存在', 404);
    }

    let clean = key;
    try { clean = decodeURIComponent(key); } catch { /* 保持原样 */ }
    if (!clean || clean.includes('..')) throw new ApiError('文件不存在', 404);

    const isGet = request.method === 'GET';
    const cache = caches.default;
    const cacheKey = new Request(`https://public.cache${ctx.url.pathname}`, { method: 'GET' });

    if (isGet) {
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
    }

    const stored = await env.UPLOAD.getWithMetadata(clean, { type: 'arrayBuffer' });
    if (!stored || !stored.value) throw new ApiError('文件不存在', 404);

    const meta = stored.metadata || {};
    const type = meta.contentType || 'application/octet-stream';

    const headers = new Headers();
    headers.set('content-type', type);
    headers.set('content-length', String(stored.value.byteLength));
    headers.set('etag', `"kv-${stored.value.byteLength}-${meta.size || 0}"`);
    /* 7 天：兼顾「少打 KV / 少占 Worker 请求」与「过期回收后尽快 404」。
       不要用 1 年，否则删除的文件还能从边缘缓存里读出来。 */
    headers.set('Cache-Control', 'public, max-age=604800');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Access-Control-Allow-Origin', ctx.cors['Access-Control-Allow-Origin'] || '*');

    if (!type.startsWith('image/')) {
        headers.set('Content-Disposition', 'attachment');
    } else {
        headers.set('Content-Disposition', 'inline');
    }

    const response = new Response(stored.value, { headers });
    if (isGet) await cache.put(cacheKey, response.clone());
    return response;
}

export async function handleUser(request, env, ctx, rest) {
    const [first_, second] = rest;

    if (ctx.method === 'POST' && first_ === 'login') return login(request, env, ctx);
    if (ctx.method === 'POST' && first_ === 'upload') return upload(request, env, ctx);
    if (ctx.method === 'GET' && first_ === 'search') return search(request, env, ctx);

    if (!first_) {
        if (ctx.method === 'POST') return register(request, env, ctx);
        if (ctx.method === 'GET') return list(request, env, ctx);
        return null;
    }

    const id = decodeURIComponent(first_);
    if (second) return null;
    if (ctx.method === 'GET') return detail(request, env, ctx, id);
    if (ctx.method === 'PATCH') return update(request, env, ctx, id);
    if (ctx.method === 'DELETE') return remove(request, env, ctx, id);
    return null;
}
