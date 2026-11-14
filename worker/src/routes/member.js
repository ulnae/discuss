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
import { pushToUsers, pushToRoom, pushRoomOnline, syncUserRooms } from '../lib/realtime.js';
import { EVENTS } from '../lib/events.js';

const MEMBER_SELECT = `
    SELECT m.id, m.user_id, m.room_id, m.createdAt,
           u.id AS u_id, u.username AS u_username,
           r.id AS r_id, r.name AS r_name, r.creator AS r_creator,
           r.description AS r_description,
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
        ? { id: row.u_id, username: row.u_username }
        : null,
    room_info: row.r_id
        ? { id: row.r_id, name: row.r_name, creator: row.r_creator, description: row.r_description, createdAt: iso(row.r_createdAt), updatedAt: iso(row.r_updatedAt) }
        : null
});

async function create(request, env, ctx) {
    const me = await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const userId = String(body.user_id || '');
    const roomId = String(body.room_id || '');
    if (!userId || !roomId) throw new ApiError('缺少 user_id 或 room_id', 400);

    const room = await first(env, 'SELECT id, name, creator FROM room WHERE id = ? AND isDeleted = 0', roomId);
    if (!room) throw new ApiError('房间不存在', 404);
    if (room.creator !== me.id) throw new ApiError('只有群主可以添加成员', 401);

    const existing = await first(env, 'SELECT id FROM member WHERE user_id = ? AND room_id = ? AND isDeleted = 0', userId, roomId);
    if (existing) {
        const row = await first(env, `${MEMBER_SELECT} WHERE m.id = ?`, existing.id);
        return ok(memberView(row), ctx.cors);
    }

    const id = uuid();
    const timestamp = now();
    await run(env, 'INSERT INTO member (id, user_id, room_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', id, userId, roomId, timestamp);
    const row = await first(env, `${MEMBER_SELECT} WHERE m.id = ?`, id);

    /* 被拉进房间的人需要立刻在列表里看到这个房间，并且能收到房间消息 */
    await syncUserRooms(env, userId);
    await pushToUsers(env, [userId], EVENTS.ROOM_JOINED, { roomId: room.id, roomName: room.name });
    await pushToRoom(env, roomId, EVENTS.MEMBER_JOINED, {
        roomId,
        userId,
        username: memberView(row).user_info && memberView(row).user_info.username
    }, userId);
    /* 新成员此刻多半在线，补发一次在线名单，避免所有人列表里他显示离线 */
    await pushRoomOnline(env, roomId);

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
    const me = await currentUser(request, env);
    const row = await first(env, `${MEMBER_SELECT} WHERE m.id = ? AND m.isDeleted = 0`, id);
    if (!row) throw new ApiError('该成员不存在', 401);

    /* row 是 JOIN 原始行（r_creator），视图转换后才叫 room_info.creator */
    const view = memberView(row);
    const isSelf = row.user_id === me.id;
    const isOwner = !!(view.room_info && view.room_info.creator === me.id);
    if (!isSelf && !isOwner) throw new ApiError('只有群主可以移出成员', 401);

    await run(env, 'UPDATE member SET isDeleted = 1 WHERE id = ?', id);

    const roomId = row.room_id;
    const userId = row.user_id;
    const roomName = view.room_info?.name || '';

    if (isSelf) {
        /* 主动退出：给自己一个明确的回执，并摘掉房间订阅 */
        await pushToUsers(env, [userId], EVENTS.ROOM_LEFT, { roomId, roomName });
        await syncUserRooms(env, userId);
    } else if (userId) {
        /* 被踢的人：先告诉他原因，再摘掉房间订阅（否则还能继续收房间消息） */
        await pushToUsers(env, [userId], EVENTS.ROOM_KICKED, {
            roomId,
            roomName,
            byUserId: me.id,
            byUsername: me.username
        });
        await syncUserRooms(env, userId);
    }

    /* 房间里的其他人：成员列表要减一 */
    await pushToRoom(env, roomId, EVENTS.MEMBER_REMOVED, {
        roomId,
        userId,
        byUserId: me.id,
        byUsername: me.username,
        reason: isSelf ? 'left' : 'kicked'
    }, userId);

    return ok(view, ctx.cors);
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
