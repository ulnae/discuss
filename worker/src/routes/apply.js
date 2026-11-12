/**
 * 申请模块 —— 对齐 server-nestjs 的 ApplyController
 *
 *   POST   /api/apply           发起申请（加好友 / 加房间）
 *   GET    /api/apply           我发起的申请
 *   GET    /api/apply/room?id=  某房间的待处理申请
 *   GET    /api/apply/mine      别人申请我的
 *   PATCH  /api/apply/:id       处理申请（同意时自动建立好友/成员关系）
 *   DELETE /api/apply/:id       撤回申请
 */
import { ApiError } from '../lib/errors.js';
import { ok, readJson } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';
import { all, first, run, now, uuid, iso } from '../lib/sql.js';

const APPLY_SELECT = `
    SELECT a.id, a.user_id, a.room_id, a.apply_user_id, a.status, a.handle_status,
           a.createdAt, a.updatedAt,
           u.id AS u_id, u.username AS u_username, u.email AS u_email,
           r.id AS r_id, r.name AS r_name, r.description AS r_description,
           t.id AS t_id, t.username AS t_username, t.email AS t_email
    FROM apply a
    LEFT JOIN user u ON u.id = a.user_id
    LEFT JOIN room r ON r.id = a.room_id
    LEFT JOIN user t ON t.id = a.apply_user_id
`;

const applyView = (row) => ({
    id: row.id,
    user_id: row.user_id,
    room_id: row.room_id || null,
    apply_user_id: row.apply_user_id || null,
    status: !!row.status,
    createdAt: iso(row.createdAt),
    handle_status: !!row.handle_status,
    updatedAt: iso(row.updatedAt),
    user_info: row.u_id ? { id: row.u_id, username: row.u_username, email: row.u_email } : null,
    room_info: row.r_id ? { id: row.r_id, name: row.r_name, description: row.r_description } : null,
    apply_user_info: row.t_id ? { id: row.t_id, username: row.t_username, email: row.t_email } : null
});

async function create(request, env, ctx) {
    const me = await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const roomId = body.room_id ? String(body.room_id) : null;
    const applyUserId = body.apply_user_id ? String(body.apply_user_id) : null;
    if (!roomId && !applyUserId) throw new ApiError('缺少 room_id 或 apply_user_id', 400);

    const duplicated = roomId
        ? await first(env, 'SELECT id FROM apply WHERE user_id = ? AND room_id = ? AND isDeleted = 0 AND handle_status = 0', me.id, roomId)
        : await first(env, 'SELECT id FROM apply WHERE user_id = ? AND apply_user_id = ? AND isDeleted = 0 AND handle_status = 0', me.id, applyUserId);
    if (duplicated) throw new ApiError('已存在相同申请', 401);

    const id = uuid();
    const timestamp = now();
    await run(
        env,
        'INSERT INTO apply (id, user_id, room_id, apply_user_id, status, handle_status, createdAt, updatedAt, isDeleted) VALUES (?,?,?,?,0,0,?,?,0)',
        id, me.id, roomId, applyUserId, timestamp, timestamp
    );
    const row = await first(env, `${APPLY_SELECT} WHERE a.id = ?`, id);
    return ok(applyView(row), ctx.cors);
}

async function listMine(request, env, ctx) {
    const me = await currentUser(request, env);
    const rows = await all(env, `${APPLY_SELECT} WHERE a.user_id = ? AND a.isDeleted = 0 ORDER BY a.createdAt DESC`, me.id);
    return ok(rows.map(applyView), ctx.cors);
}

async function listRoom(request, env, ctx) {
    await currentUser(request, env);
    const roomId = ctx.url.searchParams.get('id') || '';
    if (!roomId) throw new ApiError('缺少房间 id', 400);
    const rows = await all(
        env,
        `${APPLY_SELECT} WHERE a.room_id = ? AND a.isDeleted = 0 AND a.handle_status = 0 ORDER BY a.createdAt DESC`,
        roomId
    );
    return ok(rows.map(applyView), ctx.cors);
}

async function listApplyToMe(request, env, ctx) {
    const me = await currentUser(request, env);
    const rows = await all(env, `${APPLY_SELECT} WHERE a.apply_user_id = ? AND a.isDeleted = 0 ORDER BY a.createdAt DESC`, me.id);
    return ok(rows.map(applyView), ctx.cors);
}

async function update(request, env, ctx, id) {
    const me = await currentUser(request, env);
    const body = (await readJson(request)) || {};

    const row = await first(env, `${APPLY_SELECT} WHERE a.id = ? AND a.isDeleted = 0`, id);
    if (!row) throw new ApiError('申请不存在', 401);
    if (row.handle_status) throw new ApiError('已处理，不能再操作', 401);

    const apply = applyView(row);
    if (apply.apply_user_id && apply.apply_user_id !== me.id) throw new ApiError('不是被申请人，不能操作', 401);
    if (apply.apply_user_id && body.status) {
        await run(env, 'INSERT INTO friend (id, creator, friend_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', uuid(), apply.apply_user_id, apply.user_id, now());
        await run(env, 'INSERT INTO friend (id, creator, friend_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', uuid(), apply.user_id, apply.apply_user_id, now());
    }

    if (apply.room_id) {
        const room = await first(env, 'SELECT creator FROM room WHERE id = ?', apply.room_id);
        if (!room || room.creator !== me.id) throw new ApiError('不是房间创建人，不能操作', 401);
        if (body.status) {
            const exist = await first(env, 'SELECT id FROM member WHERE user_id = ? AND room_id = ? AND isDeleted = 0', apply.user_id, apply.room_id);
            if (!exist) {
                await run(env, 'INSERT INTO member (id, user_id, room_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', uuid(), apply.user_id, apply.room_id, now());
            }
        }
    }

    await run(
        env,
        'UPDATE apply SET status = ?, handle_status = 1, updatedAt = ? WHERE id = ?',
        body.status ? 1 : 0, now(), id
    );
    return ok({ affected: 1 }, ctx.cors);
}

async function remove(request, env, ctx, id) {
    await currentUser(request, env);
    const row = await first(env, 'SELECT id, handle_status FROM apply WHERE id = ? AND isDeleted = 0', id);
    if (!row) throw new ApiError('申请不存在', 401);
    if (row.handle_status) throw new ApiError('已处理，不能再操作', 401);
    await run(env, 'UPDATE apply SET isDeleted = 1, updatedAt = ? WHERE id = ?', now(), id);
    return ok({ affected: 1 }, ctx.cors);
}

export async function handleApply(request, env, ctx, rest) {
    const [head] = rest;

    if (!head) {
        if (ctx.method === 'POST') return create(request, env, ctx);
        if (ctx.method === 'GET') return listMine(request, env, ctx);
        return null;
    }
    if (ctx.method === 'GET' && head === 'room') return listRoom(request, env, ctx);
    if (ctx.method === 'GET' && head === 'mine') return listApplyToMe(request, env, ctx);

    const id = decodeURIComponent(head);
    if (ctx.method === 'PATCH') return update(request, env, ctx, id);
    if (ctx.method === 'DELETE') return remove(request, env, ctx, id);
    return null;
}
