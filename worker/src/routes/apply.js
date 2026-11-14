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
import { pushToUsers, pushToRoom, pushRoomOnline, pushUserStatus, syncUserRooms } from '../lib/realtime.js';
import { EVENTS } from '../lib/events.js';

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
    if (duplicated) throw new ApiError('已存在相同申请', 409);

    /* 申请前先确认目标有效，避免给不存在的房间/用户产生一条永远处理不掉的待办 */
    if (roomId) {
        const room = await first(env, 'SELECT id FROM room WHERE id = ? AND isDeleted = 0', roomId);
        if (!room) throw new ApiError('房间不存在', 404);
        const already = await first(env, 'SELECT id FROM member WHERE room_id = ? AND user_id = ? AND isDeleted = 0', roomId, me.id);
        if (already) throw new ApiError('你已经是该房间成员', 409);
    }
    if (applyUserId) {
        if (applyUserId === me.id) throw new ApiError('不能添加自己为好友', 400);
        const target = await first(env, 'SELECT id FROM user WHERE id = ? AND isDeleted = 0', applyUserId);
        if (!target) throw new ApiError('该用户不存在', 404);
        const befriended = await first(env, 'SELECT id FROM friend WHERE creator = ? AND friend_id = ? AND isDeleted = 0', me.id, applyUserId);
        if (befriended) throw new ApiError('你们已经是好友了', 409);
    }

    const id = uuid();
    const timestamp = now();
    await run(
        env,
        'INSERT INTO apply (id, user_id, room_id, apply_user_id, status, handle_status, createdAt, updatedAt, isDeleted) VALUES (?,?,?,?,0,0,?,?,0)',
        id, me.id, roomId, applyUserId, timestamp, timestamp
    );
    const row = await first(env, `${APPLY_SELECT} WHERE a.id = ?`, id);
    const view = applyView(row);

    /* 让接收方立刻看到这条申请，不用等下一次刷新 */
    if (applyUserId) {
        await pushToUsers(env, [applyUserId], EVENTS.FRIEND_REQUEST, { apply: view });
    } else if (roomId) {
        const room = await first(env, 'SELECT id, name, creator FROM room WHERE id = ? AND isDeleted = 0', roomId);
        if (room) {
            await pushToUsers(env, [room.creator], EVENTS.ROOM_APPLY, {
                apply: view,
                roomId: room.id,
                roomName: room.name
            });
        }
    }
    return ok(view, ctx.cors);
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
    const accepted = !!body.status;

    const row = await first(env, `${APPLY_SELECT} WHERE a.id = ? AND a.isDeleted = 0`, id);
    if (!row) throw new ApiError('申请不存在', 404);
    if (row.handle_status) throw new ApiError('已处理，不能再操作', 409);

    const apply = applyView(row);
    if (apply.apply_user_id && apply.apply_user_id !== me.id) throw new ApiError('不是被申请人，不能操作', 403);
    if (apply.apply_user_id && accepted) {
        /* 双向好友关系：双方列表都要立刻出现对方 */
        await run(env, 'INSERT OR IGNORE INTO friend (id, creator, friend_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', uuid(), apply.apply_user_id, apply.user_id, now());
        await run(env, 'INSERT OR IGNORE INTO friend (id, creator, friend_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', uuid(), apply.user_id, apply.apply_user_id, now());
    }

    let room = null;
    if (apply.room_id) {
        room = await first(env, 'SELECT id, name, creator FROM room WHERE id = ? AND isDeleted = 0', apply.room_id);
        if (!room || room.creator !== me.id) throw new ApiError('不是房间创建人，不能操作', 403);
        if (accepted) {
            const exist = await first(env, 'SELECT id FROM member WHERE user_id = ? AND room_id = ? AND isDeleted = 0', apply.user_id, apply.room_id);
            if (!exist) {
                await run(env, 'INSERT OR IGNORE INTO member (id, user_id, room_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', uuid(), apply.user_id, apply.room_id, now());
            }
        }
    }

    await run(
        env,
        'UPDATE apply SET status = ?, handle_status = 1, updatedAt = ? WHERE id = ?',
        accepted ? 1 : 0, now(), id
    );

    /* ---------- 实时通知：申请人立刻知道结果 ---------- */
    if (apply.apply_user_id) {
        await pushToUsers(env, [apply.user_id], accepted ? EVENTS.FRIEND_ACCEPTED : EVENTS.FRIEND_REJECTED, {
            applyId: id,
            status: accepted,
            userId: me.id,
            username: me.username
        });
        if (accepted) {
            /* 双向补发在线状态：双方列表刚出现对方（REST 列表不带在线状态），
               不补发的话对方即使在线也会一直显示离线 */
            await pushUserStatus(env, apply.user_id);
        }
    } else if (room) {
        await pushToUsers(env, [apply.user_id], EVENTS.ROOM_APPLY_RESULT, {
            applyId: id,
            status: accepted,
            roomId: room.id,
            roomName: room.name
        });
        if (accepted) {
            /* 订阅先刷新，再广播成员变化，保证新成员能收到后续房间消息 */
            await syncUserRooms(env, apply.user_id);
            await pushToRoom(env, room.id, EVENTS.MEMBER_JOINED, {
                roomId: room.id,
                userId: apply.user_id,
                username: apply.user_info && apply.user_info.username
            }, apply.user_id);
            /* 成员列表刷新后补发一次在线名单：房间所有人（含新成员自己）的在线集合即时更新 */
            await pushRoomOnline(env, room.id);
        }
    }

    return ok({ affected: 1 }, ctx.cors);
}

async function remove(request, env, ctx, id) {
    const me = await currentUser(request, env);
    const row = await first(env, `${APPLY_SELECT} WHERE a.id = ? AND a.isDeleted = 0`, id);
    if (!row) throw new ApiError('申请不存在', 404);
    if (row.handle_status) throw new ApiError('已处理，不能再操作', 409);
    const apply = applyView(row);
    if (apply.user_id !== me.id) throw new ApiError('只能撤回自己发起的申请', 403);

    await run(env, 'UPDATE apply SET isDeleted = 1, updatedAt = ? WHERE id = ?', now(), id);

    /* 撤回后接收方的待办列表要立刻消失 */
    if (apply.apply_user_id) {
        await pushToUsers(env, [apply.apply_user_id], EVENTS.APPLY_REVOKED, { applyId: id, fromUserId: apply.user_id });
    } else if (apply.room_id) {
        const room = await first(env, 'SELECT creator FROM room WHERE id = ?', apply.room_id);
        if (room) {
            await pushToUsers(env, [room.creator], EVENTS.APPLY_REVOKED, {
                applyId: id,
                fromUserId: apply.user_id,
                roomId: apply.room_id
            });
        }
    }
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
