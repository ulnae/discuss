/**
 * 房间成员 —— 对齐 server-nestjs 的 MemberController
 *
 *   POST   /api/member        新增成员
 *   GET    /api/member        查询（支持 ?user_id= &room_id= 过滤）
 *   DELETE /api/member/:id    软删除
 */
import { ApiError } from '../lib/errors.js';
import { ok, readJson } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';
import { all, first, run, now, uuid, iso } from '../lib/sql.js';

const MEMBER_SELECT = `
    SELECT m.id, m.user_id, m.room_id, m.createdAt,
           u.id AS u_id, u.username AS u_username, u.email AS u_email,
           u.createdAt AS u_createdAt, u.updatedAt AS u_updatedAt,
           r.id AS r_id, r.name AS r_name, r.creator AS r_creator,
           r.createdAt AS r_createdAt, r.updatedAt AS r_updatedAt
    FROM member m
    LEFT JOIN user u ON u.id = m.user_id
    LEFT JOIN room r ON r.id = m.room_id
`;

const memberView = (row) => ({
    id: row.id,
    user_id: row.user_id,
    room_id: row.room_id,
    createdAt: iso(row.createdAt),
    user_info: row.u_id
        ? { id: row.u_id, username: row.u_username, email: row.u_email, createdAt: iso(row.u_createdAt), updatedAt: iso(row.u_updatedAt) }
        : null,
    room_info: row.r_id
        ? { id: row.r_id, name: row.r_name, creator: row.r_creator, createdAt: iso(row.r_createdAt), updatedAt: iso(row.r_updatedAt) }
        : null
});

async function create(request, env, ctx) {
    await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const userId = String(body.user_id || '');
    const roomId = String(body.room_id || '');
    if (!userId || !roomId) throw new ApiError('缺少 user_id 或 room_id', 400);

    const existing = await first(env, 'SELECT id FROM member WHERE user_id = ? AND room_id = ? AND isDeleted = 0', userId, roomId);
    if (existing) {
        const row = await first(env, `${MEMBER_SELECT} WHERE m.id = ?`, existing.id);
        return ok(memberView(row), ctx.cors);
    }

    const id = uuid();
    const timestamp = now();
    await run(env, 'INSERT INTO member (id, user_id, room_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', id, userId, roomId, timestamp);
    const row = await first(env, `${MEMBER_SELECT} WHERE m.id = ?`, id);
    return ok(memberView(row), ctx.cors);
}

async function list(request, env, ctx) {
    await currentUser(request, env);
    const conditions = ['m.isDeleted = 0'];
    const args = [];
    for (const key of ['user_id', 'room_id']) {
        const value = ctx.url.searchParams.get(key);
        if (value) { conditions.push(`m.${key} = ?`); args.push(value); }
    }
    const rows = await all(env, `${MEMBER_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY m.createdAt DESC`, ...args);
    return ok(rows.map(memberView), ctx.cors);
}

async function remove(request, env, ctx, id) {
    await currentUser(request, env);
    const row = await first(env, 'SELECT id FROM member WHERE id = ? AND isDeleted = 0', id);
    if (!row) throw new ApiError('该成员不存在', 401);
    await run(env, 'UPDATE member SET isDeleted = 1 WHERE id = ?', id);
    const updated = await first(env, `${MEMBER_SELECT} WHERE m.id = ?`, id);
    return ok(memberView(updated), ctx.cors);
}

export async function handleMember(request, env, ctx, rest) {
    const [head] = rest;
    if (!head) {
        if (ctx.method === 'POST') return create(request, env, ctx);
        if (ctx.method === 'GET') return list(request, env, ctx);
        return null;
    }
    if (ctx.method === 'DELETE') return remove(request, env, ctx, decodeURIComponent(head));
    return null;
}
