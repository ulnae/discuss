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
 *   POST   /api/user/upload     文件上传（R2 可选，未绑定时 501）
 */
import { ApiError, notImplemented } from '../lib/errors.js';
import { ok, readJson, pageOf } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';
import { signToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword, iterationsOf } from '../lib/password.js';
import { all, first, run, now, uuid, iso, count } from '../lib/sql.js';
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
    if (row) throw new ApiError(message, 401);
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
    if (!row) throw new ApiError('该用户不存在', 401);
    return ok(userView(row), ctx.cors);
}

async function update(request, env, ctx, id) {
    const me = await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const exist = await first(env, 'SELECT * FROM user WHERE id = ? AND isDeleted = 0', id);
    if (!exist) throw new ApiError(`id为${id}的用户不存在`, 401);
    if (me.id !== id) throw new ApiError('您没有权限更新该用户', 401);

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
    await currentUser(request, env);
    const exist = await first(env, 'SELECT id FROM user WHERE id = ? AND isDeleted = 0', id);
    if (!exist) throw new ApiError(`id为${id}的用户不存在`, 401);
    await run(env, 'UPDATE user SET isDeleted = 1, updatedAt = ? WHERE id = ?', now(), id);
    return ok('删除用户成功', ctx.cors);
}

/**
 * 文件上传：形状与 NestJS multer 版一致
 *   { code:200, message, filename, originalname, size, mimetype, path, userId, uploadTime }
 * 前端把 path 拼成 `${VITE_APP_API_BASE_URL}/${path}` 访问，
 * 所以 path 形如 public/<userId>/<file>，由 /public/* 路由从 R2 读回。
 */
async function upload(request, env, ctx) {
    const me = await currentUser(request, env);
    if (!env.UPLOAD) {
        throw notImplemented('当前 Worker 未绑定 R2 存储桶，文件上传功能未启用');
    }

    const form = await request.formData().catch(() => null);
    const file = form && form.get('file');
    if (!file || typeof file === 'string') throw new ApiError('未选择文件', 400);

    const limit = parseInt(env.UPLOAD_MAX_BYTES || '26214400', 10);
    if (file.size > limit) throw new ApiError(`文件不能超过 ${Math.round(limit / 1048576)}MB`, 400);

    const originalname = file.name || 'file';
    const ext = (originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    const filename = `${Math.round(Math.random() * 1e9)}${ext}`;
    const key = `${me.id}/${filename}`;

    await env.UPLOAD.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });

    return ok({
        code: 200,
        message: '文件上传成功',
        filename,
        originalname,
        size: file.size,
        mimetype: file.type || 'application/octet-stream',
        path: `public/${key}`,
        userId: me.id,
        uploadTime: Date.now()
    }, ctx.cors);
}

/** /public/<userId>/<filename> → R2 */
export async function servePublicFile(request, env, ctx, key) {
    if (!env.UPLOAD) throw new ApiError('文件不存在', 404);
    const object = await env.UPLOAD.get(key);
    if (!object) throw new ApiError('文件不存在', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', ctx.cors['Access-Control-Allow-Origin'] || '*');
    return new Response(object.body, { headers });
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
