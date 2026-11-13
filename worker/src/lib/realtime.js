/**
 * 实时事件推送 —— REST 写操作完成后，让在线客户端立刻感知变化。
 *
 * 覆盖的场景（与前端 socket store 的事件名一一对应）：
 *   加好友申请 / 申请被同意 / 申请被拒绝 / 被删除好友
 *   入群申请 / 入群申请结果 / 新成员加入 / 成员被移出 / 被踢出房间 / 房间被删除
 *
 * 两条原则：
 *   1. 推送失败绝不影响主流程。REST 已经把数据写进 D1，客户端下次拉取就能自愈，
 *      所以这里全部 try/catch，最坏情况只是「晚几秒看到」。
 *   2. 成员关系变化后必须 syncUserRooms：Durable Object 的房间订阅存在 socket
 *      attachment 里，不刷新的话新加入的房间收不到消息、被踢的房间还能收到消息。
 */
import { now } from './sql.js';

function hub(env) {
    return env.HUB ? env.HUB.get(env.HUB.idFromName('hub')) : null;
}

async function post(env, path, body) {
    const stub = hub(env);
    if (!stub) return 0;
    try {
        const response = await stub.fetch(`https://hub${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await response.json().catch(() => ({}));
        return json.delivered ?? json.updated ?? 0;
    } catch (error) {
        console.warn('[realtime]', path, error && error.message);
        return 0;
    }
}

/** 推给指定用户（多标签页会全部收到） */
export function pushToUsers(env, userIds, event, data) {
    const users = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (!users.length) return Promise.resolve(0);
    return post(env, '/notify', { users, event, data });
}

/** 推给某个房间的在线成员；exclude 用于排除操作者自己 */
export function pushToRoom(env, roomId, event, data, exclude) {
    if (!roomId) return Promise.resolve(0);
    return post(env, '/notify', {
        rooms: [String(roomId)],
        event,
        data,
        exclude: exclude ? String(exclude) : null
    });
}

/** 成员关系变化后向房间全员补发当前在线名单（新成员也在列） */
export function pushRoomOnline(env, roomId) {
    if (!roomId) return Promise.resolve(0);
    return post(env, '/push-room-online', { roomId: String(roomId) });
}

/** 好友关系变化后向双向补发当前在线状态（新好友可能此刻就在线） */
export function pushUserStatus(env, userId) {
    if (!userId) return Promise.resolve(0);
    return post(env, '/push-friend-status', { userId: String(userId) });
}

/** 成员关系变化后刷新该用户的房间订阅 */
export async function syncUserRooms(env, userId) {    if (!userId || !env.DB) return 0;
    try {
        const { results } = await env.DB
            .prepare('SELECT room_id FROM member WHERE user_id = ? AND isDeleted = 0')
            .bind(String(userId))
            .all();
        return post(env, '/sync', {
            userId: String(userId),
            rooms: (results || []).map(row => row.room_id)
        });
    } catch (error) {
        console.warn('[realtime] sync', error && error.message);
        return 0;
    }
}

/** 房间被删除：把所有连接上的该房间订阅一起摘掉 */
export function dropRoom(env, roomId) {
    if (!roomId) return Promise.resolve(0);
    return post(env, '/drop-room', { roomId: String(roomId) });
}

/** 统一的「用户可见」事件外壳，方便前端识别来源与时间 */
export function envelope(data) {
    return { ...data, timestamp: now() };
}
