/**
 * 好友模块 —— 对齐 server-nestjs 的 FriendController
 *
 *   POST   /api/friend        新增好友关系
 *   GET    /api/friend        我的好友列表
 *   DELETE /api/friend/:id    删除（:id 是对方的 user_id，与 NestJS 一致）
 */
import { ApiError } from '../lib/errors.js';
import { ok, readJson } from '../lib/http.js';
import { currentUser } from '../lib/auth.js';
import { all, first, run, now, uuid, iso } from '../lib/sql.js';
import { pushToUsers, pushUserStatus } from '../lib/realtime.js';

const FRIEND_SELECT = `
    SELECT f.id, f.creator, f.friend_id, f.createdAt,
           c.username AS c_username, c.email AS c_email, c.createdAt AS c_createdAt,
           t.username AS t_username, t.email AS t_email, t.createdAt AS t_createdAt
    FROM friend f
    LEFT JOIN user c ON c.id = f.creator
    LEFT JOIN user t ON t.id = f.friend_id
`;

const friendView = (row) => ({
    id: row.id,
    friend_id: row.friend_id,
    createdAt: iso(row.createdAt),
    creator: row.creator,
    friend_info: {
        id: row.friend_id,
        username: row.t_username,
        email: row.t_email,
        createdAt: iso(row.t_createdAt)
    },
    user_info: {
        id: row.creator,
        username: row.c_username,
        email: row.c_email,
        createdAt: iso(row.c_createdAt)
    }
});

async function create(request, env, ctx) {
    const me = await currentUser(request, env);
    const body = (await readJson(request)) || {};
    const creator = String(body.creator || me.id);
    const friendId = String(body.friend_id || '');
    if (!friendId) throw new ApiError('缺少 friend_id', 400);
    if (friendId === creator) throw new ApiError('不能添加自己为好友', 400);

    const exist = await first(env, 'SELECT id FROM friend WHERE creator = ? AND friend_id = ? AND isDeleted = 0', creator, friendId);
    if (exist) throw new ApiError('好友关系已存在', 401);

    const id = uuid();
    await run(env, 'INSERT INTO friend (id, creator, friend_id, createdAt, isDeleted) VALUES (?,?,?,?,0)', id, creator, friendId, now());
    const row = await first(env, `${FRIEND_SELECT} WHERE f.id = ?`, id);
    /* 对方也要立刻看到这条好友关系 */
    await pushToUsers(env, [friendId], 'friend:added', {
        user: { id: creator, username: row && row.c_username }
    });
    /* 补发双向在线状态：双方列表刚出现对方，可能此刻就在线 */
    await pushUserStatus(env, creator);
    return ok(friendView(row), ctx.cors);
}

async function list(request, env, ctx) {
    const me = await currentUser(request, env);
    const rows = await all(env, `${FRIEND_SELECT} WHERE f.creator = ? AND f.isDeleted = 0 ORDER BY f.createdAt DESC`, me.id);
    return ok(rows.map(friendView), ctx.cors);
}

async function remove(request, env, ctx, friendId) {
    const me = await currentUser(request, env);
    const row = await first(env, 'SELECT id FROM friend WHERE creator = ? AND friend_id = ? AND isDeleted = 0', me.id, friendId);

    /* 单向记录不存在时也允许清理对方那侧，避免历史数据残留导致「删不掉」 */
    if (!row) {
        const reverse = await first(env, 'SELECT id FROM friend WHERE creator = ? AND friend_id = ? AND isDeleted = 0', friendId, me.id);
        if (!reverse) throw new ApiError('好友关系不存在', 401);
    }

    /* 双向软删：好友是双方关系，只删自己那侧会让对方列表里还留着一个「幽灵好友」 */
    await run(
        env,
        'UPDATE friend SET isDeleted = 1 WHERE (creator = ? AND friend_id = ?) OR (creator = ? AND friend_id = ?)',
        me.id, friendId, friendId, me.id
    );

    await pushToUsers(env, [friendId], 'friend:removed', {
        userId: me.id,
        username: me.username
    });
    return ok({ affected: 1 }, ctx.cors);
}

export async function handleFriend(request, env, ctx, rest) {
    const [head] = rest;
    if (!head) {
        if (ctx.method === 'POST') return create(request, env, ctx);
        if (ctx.method === 'GET') return list(request, env, ctx);
        return null;
    }
    if (ctx.method === 'DELETE') return remove(request, env, ctx, decodeURIComponent(head));
    return null;
}
