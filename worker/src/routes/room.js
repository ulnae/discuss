/**
 * 房间模块 —— 对齐 server-nestjs 的 RoomController
 *
 *   POST   /api/room            创建房间（同时把自己写入成员表）
 *   GET    /api/room            分页列表
 *   GET    /api/room/search     按名称搜索
 *   GET    /api/room/mine       我创建的房间
 *   GET    /api/room/:id        详情
 *   PATCH  /api/room/:id        更新
 *   DELETE /api/room/:id        软删除（并软删成员）
 */
import { ApiError } from '../lib/errors.js';
import { ok, readJson, pageOf } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';
import { all, first, run, now, uuid, iso, count } from '../lib/sql.js';
import { pushToRoom, syncUserRooms, dropRoom } from '../lib/realtime.js';

const ROOM_SELECT = `
    SELECT r.id, r.name, r.description, r.creator, r.createdAt, r.updatedAt,
           u.id AS u_id, u.username AS u_username, u.email AS u_email,
           u.createdAt AS u_createdAt, u.updatedAt AS u_updatedAt
    FROM room r
    LEFT JOIN user u ON u.id = r.creator
`;

const roomView = (row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    creator: row.creator,
    user_info: row.u_id
        ? { id: row.u_id, username: row.u_username, email: row.u_email, createdAt: iso(row.u_createdAt), updatedAt: iso(row.u_updatedAt) }
        : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
});

async function create(request, env, ctx) {
    const me = await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const name = String(body.name || '').trim();
    if (!name) throw new ApiError('房间名称不能为空', 400);

    const duplicated = await first(env, 'SELECT id FROM room WHERE name = ? AND isDeleted = 0', name);
    if (duplicated) throw new ApiError('房间名称已存在', 400);

    const timestamp = now();
    const roomId = uuid();
    await run(
        env,
        'INSERT INTO room (id, name, description, creator, createdAt, updatedAt, isDeleted) VALUES (?,?,?,?,?,?,0)',
        roomId, name, String(body.description || ''), me.id, timestamp, timestamp
    );
    await run(
        env,
        'INSERT INTO member (id, user_id, room_id, createdAt, isDeleted) VALUES (?,?,?,?,0)',
        uuid(), me.id, roomId, timestamp
    );
    /* 新房间要立刻进自己的房间订阅，否则马上发消息会被房间校验挡下 */
    await syncUserRooms(env, me.id);
    return ok('创建房间成功', ctx.cors);
}

async function list(request, env, ctx) {
    await currentUser(request, env);
    const { pageSize, offset } = pageOf(ctx.url.searchParams);
    const rows = await all(env, `${ROOM_SELECT} WHERE r.isDeleted = 0 ORDER BY r.createdAt ASC LIMIT ? OFFSET ?`, pageSize, offset);
    const total = await count(env, 'SELECT COUNT(*) AS total FROM room WHERE isDeleted = 0');
    return ok({ rows: rows.map(roomView), total }, ctx.cors);
}

async function mine(request, env, ctx) {
    const me = await currentUser(request, env);
    const { pageSize, offset } = pageOf(ctx.url.searchParams);
    const rows = await all(
        env,
        `${ROOM_SELECT} WHERE r.isDeleted = 0 AND r.creator = ? ORDER BY r.createdAt ASC LIMIT ? OFFSET ?`,
        me.id, pageSize, offset
    );
    const total = await count(env, 'SELECT COUNT(*) AS total FROM room WHERE isDeleted = 0 AND creator = ?', me.id);
    return ok({ rows: rows.map(roomView), total }, ctx.cors);
}

async function search(request, env, ctx) {
    await currentUser(request, env);
    const name = ctx.url.searchParams.get('name') || '';
    const rows = await all(
        env,
        `${ROOM_SELECT} WHERE r.isDeleted = 0 AND r.name LIKE ? ORDER BY r.createdAt ASC`,
        `%${name}%`
    );
    return ok(rows.map(roomView), ctx.cors);
}

async function detail(request, env, ctx, id) {
    await currentUser(request, env);
    const row = await first(env, `${ROOM_SELECT} WHERE r.id = ? AND r.isDeleted = 0`, id);
    if (!row) throw new ApiError(`id为${id}的房间不存在`, 401);
    return ok(roomView(row), ctx.cors);
}

async function update(request, env, ctx, id) {
    await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const exist = await first(env, 'SELECT id FROM room WHERE id = ? AND isDeleted = 0', id);
    if (!exist) throw new ApiError(`id为${id}的房间不存在`, 401);

    const fields = [];
    const args = [];
    if (body.name) {
        const duplicated = await first(env, 'SELECT id FROM room WHERE name = ? AND id <> ? AND isDeleted = 0', String(body.name), id);
        if (duplicated) throw new ApiError('房间名称已存在', 400);
        fields.push('name = ?'); args.push(String(body.name).trim());
    }
    if (body.description) {
        fields.push('description = ?'); args.push(String(body.description));
    }
    if (fields.length) {
        fields.push('updatedAt = ?'); args.push(now(), id);
        await run(env, `UPDATE room SET ${fields.join(', ')} WHERE id = ?`, ...args);

        const updated = await first(env, `${ROOM_SELECT} WHERE r.id = ?`, id);
        if (updated) {
            await pushToRoom(env, id, 'room:updated', { room: roomView(updated) }, me.id);
        }
    }
    return ok('更新房间成功', ctx.cors);
}

async function remove(request, env, ctx, id) {
    const me = await currentUser(request, env);
    const exist = await first(env, 'SELECT id, name, creator FROM room WHERE id = ? AND isDeleted = 0', id);
    if (!exist) throw new ApiError(`id为${id}的房间不存在`, 401);
    if (exist.creator !== me.id) throw new ApiError('只有群主可以解散房间', 401);

    await run(env, 'UPDATE room SET isDeleted = 1, updatedAt = ? WHERE id = ?', now(), id);
    await run(env, 'UPDATE member SET isDeleted = 1 WHERE room_id = ?', id);

    /* 解散房间：所有在线成员立刻收到通知，并把房间从订阅里摘掉 */
    await pushToRoom(env, id, 'room:deleted', {
        roomId: id,
        roomName: exist.name,
        by: { id: me.id, username: me.username }
    });
    await dropRoom(env, id);

    return ok('删除房间成功', ctx.cors);
}

export async function handleRoom(request, env, ctx, rest) {
    const [head] = rest;

    if (!head) {
        if (ctx.method === 'POST') return create(request, env, ctx);
        if (ctx.method === 'GET') return list(request, env, ctx);
        return null;
    }
    if (ctx.method === 'GET' && head === 'search') return search(request, env, ctx);
    if (ctx.method === 'GET' && head === 'mine') return mine(request, env, ctx);

    const id = decodeURIComponent(head);
    if (ctx.method === 'GET') return detail(request, env, ctx, id);
    if (ctx.method === 'PATCH') return update(request, env, ctx, id);
    if (ctx.method === 'DELETE') return remove(request, env, ctx, id);
    return null;
}
