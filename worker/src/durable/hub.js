/**
 * DiscussHub —— 实时通信 Durable Object
 *
 * 替代 server-nestjs 的 Socket.IO 网关（socket.gateway.ts）。
 * 事件名集中在 src/lib/events.js，契约见 Discuss/docs/realtime-contract.md：
 *   客户端 → 服务端：init / send:user / send:room / call:* / webrtc:*
 *   服务端 → 客户端：message:user / message:room / online:room / online:friends /
 *                    status:friend / friend:* / room:* / member:* / apply:revoked /
 *                    kicked / system:alert / exception / call:*
 *
 * 报文里的标识字段统一为 roomId / userId，消息方向统一为 from / to。
 *
 * 省额度三件事：
 *   1. 用 Hibernation API（state.acceptWebSocket）。空闲连接不会被计费时长，
 *      DO 可以直接休眠，消息来了再唤醒 —— 这是「socket 休眠」的落点。
 *   2. setWebSocketAutoResponse 让 "ping" → "pong" 在边缘直接应答，
 *      心跳不会唤醒 DO，也不消耗一次请求。
 *   3. 通话会话等少量状态放 storage，休眠后不丢；其余全走 socket tag + attachment。
 *
 * 单实例（idFromName('hub')）：好友/房间关系本来就在同一个 D1 里，
 * 一个小型聊天室用一个 DO 足够，也避免跨 DO 转发。
 */

import { EVENTS } from '../lib/events.js';

const RING_TIMEOUT = 30_000;
/** 消息频率限制：5 秒内最多 20 条，超出回一条 exception（不封禁，只挡刷屏） */
const RATE_WINDOW = 5_000;
const RATE_LIMIT = 20;

const frame = (event, data) => JSON.stringify({ event, data });
const now = () => Date.now();

export class DiscussHub {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        /* roomId → Set<WebSocket> 内存索引。
           不建索引的话，每条群消息都要遍历全部连接并逐个 deserializeAttachment，
           复杂度是 O(全站在线连接数)；建索引后一次群消息只碰该房间的连接。
           索引在成员关系变化时置空，下次用到时从 attachment 重建（休眠唤醒后同样适用）。 */
        this.roomIndex = null;
        this.hits = null;
        try {
            this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
        } catch {
            /* 老 runtime 不支持时退化：由 webSocketMessage 里的 ping 分支兜底 */
        }
    }

    /* ==================== HTTP 入口 ==================== */

    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname.endsWith('/ws')) return this.accept(request);

        if (url.pathname === '/broadcast') {
            const body = await request.json().catch(() => null);
            if (!body || !body.event) return new Response('bad request', { status: 400 });
            const delivered = this.broadcastAll(body.event, body.data);
            return Response.json({ ok: true, delivered });
        }

        /* 定向推送：REST 写操作（加好友/踢人/删房间…）完成后由 Worker 调用 */
        if (url.pathname === '/notify') {
            const body = await request.json().catch(() => null);
            if (!body || !body.event) return new Response('bad request', { status: 400 });
            let delivered = 0;
            for (const userId of body.users || []) {
                delivered += this.sendToUser(userId, body.event, body.data);
            }
            for (const roomId of body.rooms || []) {
                delivered += this.sendToRoom(roomId, body.event, body.data, body.exclude);
            }
            return Response.json({ ok: true, delivered });
        }

        /* 成员加入/退出后向房间全员补发当前在线名单（新成员也在列） */
        if (url.pathname === '/push-room-online') {
            const body = await request.json().catch(() => null);
            if (!body || !body.roomId) return new Response('bad request', { status: 400 });
            const roomId = String(body.roomId);
            const delivered = this.sendToRoom(roomId, EVENTS.ONLINE_ROOM, {
                roomId,
                users: this.roomUsers(roomId),
                timestamp: now()
            });
            return Response.json({ ok: true, delivered });
        }

        /* 好友关系变化后向双向补发当前在线状态：
           好友的列表里可能刚出现这个人（REST 列表不带在线状态），靠这里即时校正 */
        if (url.pathname === '/push-friend-status') {
            const body = await request.json().catch(() => null);
            if (!body || !body.userId) return new Response('bad request', { status: 400 });
            const userId = String(body.userId);
            const online = this.userSockets(userId).length > 0;
            const { results } = await this.env.DB
                .prepare('SELECT friend_id FROM friend WHERE creator = ? AND isDeleted = 0')
                .bind(userId)
                .all();
            let delivered = 0;
            for (const row of results || []) {
                const mine = { userId, status: online, timestamp: now() };
                delivered += this.sendToUser(row.friend_id, EVENTS.STATUS_FRIEND, mine);
                if (this.userSockets(row.friend_id).length) {
                    const theirs = { userId: row.friend_id, status: true, timestamp: now() };
                    delivered += this.sendToUser(userId, EVENTS.STATUS_FRIEND, theirs);
                }
            }
            return Response.json({ ok: true, delivered });
        }

        /* 批量查询若干房间的在线名单（供 /api/room/overview 聚合接口使用） */
        if (url.pathname === '/rooms-online') {
            const body = await request.json().catch(() => null);
            const rooms = Array.isArray(body && body.rooms) ? body.rooms.map(String) : [];
            const online = {};
            for (const room of rooms) online[room] = this.roomUsers(room);
            return Response.json({ ok: true, online });
        }

        /* 房间成员变动后刷新某个用户的房间订阅（否则新加入的房间收不到消息） */
        if (url.pathname === '/sync') {
            const body = await request.json().catch(() => null);
            if (!body || !body.userId) return new Response('bad request', { status: 400 });
            const rooms = Array.isArray(body.rooms) ? body.rooms.map(String) : [];
            let updated = 0;
            for (const socket of this.userSockets(String(body.userId))) {
                const info = this.attach(socket) || {};
                try {
                    socket.serializeAttachment({ ...info, rooms });
                    updated++;
                } catch { /* socket 已关闭 */ }
            }
            this.invalidateRoomIndex();
            return Response.json({ ok: true, updated });
        }

        /* 房间被删除：把该房间从所有连接的订阅里摘掉 */
        if (url.pathname === '/drop-room') {
            const body = await request.json().catch(() => null);
            if (!body || !body.roomId) return new Response('bad request', { status: 400 });
            const roomId = String(body.roomId);
            let updated = 0;
            for (const socket of this.state.getWebSockets()) {
                const info = this.attach(socket);
                if (!info || !Array.isArray(info.rooms) || !info.rooms.includes(roomId)) continue;
                try {
                    socket.serializeAttachment({ ...info, rooms: info.rooms.filter(id => id !== roomId) });
                    updated++;
                } catch { /* ignore */ }
            }
            this.invalidateRoomIndex();
            return Response.json({ ok: true, updated });
        }

        if (url.pathname === '/stats') {
            return Response.json({ sockets: this.state.getWebSockets().length });
        }

        return new Response('not found', { status: 404 });
    }

    /* ==================== 连接建立 ==================== */

    async accept(request) {
        const userId = request.headers.get('x-user-id');
        const username = decodeURIComponent(request.headers.get('x-username') || '');
        if (!userId) return new Response('unauthorized', { status: 401 });

        const rooms = await this.userRooms(userId);
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        /* 第二个参数是 tag：可按用户批量取连接，休眠后依然有效 */
        this.state.acceptWebSocket(server, [userId, ...rooms.map(id => `room:${id}`)]);
        server.serializeAttachment({ userId, username, rooms });
        this.invalidateRoomIndex();

        return new Response(null, { status: 101, webSocket: client });
    }

    /* ==================== 消息分发 ==================== */

    async webSocketMessage(ws, message) {
        if (typeof message !== 'string') return;
        if (message === 'ping') { this.safeSend(ws, 'pong'); return; }

        let packet;
        try { packet = JSON.parse(message); } catch { return; }
        const { event, data } = packet || {};
        if (!event) return;

        /* 只对发消息做限流：通话信令与 init 本来就低频，不能因为限流丢掉状态机 */
        if ((event === EVENTS.SEND_USER || event === EVENTS.SEND_ROOM) && this.overRate(ws)) {
            this.safeSend(ws, frame(EVENTS.EXCEPTION, { event, message: '发送太快了，请稍后再试', timestamp: now() }));
            return;
        }

        try {
            switch (event) {
                case EVENTS.INIT: return await this.onInit(ws);
                case EVENTS.SEND_USER: return this.onUserMessage(ws, data);
                case EVENTS.SEND_ROOM: return this.onRoomMessage(ws, data);
                case EVENTS.CALL_INVITE: return this.onCallInvite(ws, data);
                case EVENTS.CALL_ACCEPT: return this.onCallAccept(ws, data);
                case EVENTS.CALL_REJECT: return this.onCallReject(ws, data);
                case EVENTS.CALL_CANCEL: return this.onCallCancel(ws, data);
                case EVENTS.CALL_END: return this.onCallEnd(ws, data);
                case EVENTS.WEBRTC_OFFER:
                case EVENTS.WEBRTC_ANSWER:
                case EVENTS.WEBRTC_CANDIDATE: return this.onRtcSignal(event, ws, data);
                default: return;
            }
        } catch (error) {
            /* 与 NestJS 网关的语义对齐：处理失败时回一条 exception，前端据此提示 */
            console.error('[hub] handle event failed', event, error && error.message);
            this.safeSend(ws, frame(EVENTS.EXCEPTION, { event, message: '消息处理失败，请重试', timestamp: now() }));
        }
    }

    async webSocketClose(ws) {
        this.forget(ws);
        await this.onOffline(ws);
    }

    async webSocketError(ws) {
        this.forget(ws);
        await this.onOffline(ws);
    }

    /** 连接结束时清掉索引与限流状态 */
    forget(ws) {
        this.invalidateRoomIndex();
        if (this.hits) this.hits.delete(ws);
    }

    /* ==================== 上线 / 下线 ==================== */

    async onInit(ws) {
        const me = this.attach(ws);
        if (!me.userId) return;

        /* 多端 / 多标签页允许并存（hub 本身支持一个用户多条连接），
           不再做「单端登录互踢」；'kicked' 事件保留给未来的设备管理 */

        /* 每次（重）连都重新读一次成员表：重连本身就是「房间订阅自愈」的时机 */
        const rooms = await this.userRooms(me.userId);
        try { ws.serializeAttachment({ ...me, rooms }); } catch { /* ignore */ }
        this.invalidateRoomIndex();

        for (const room of rooms) {
            const users = this.roomUsers(room);
            /* 重连风暴防护：在线名单没变化的房间只补发给重连者本人，不惊动全屋 */
            if (await this.roomOnlineChanged(room, users)) {
                this.sendToRoom(room, EVENTS.ONLINE_ROOM, { roomId: room, users, timestamp: now() });
            } else {
                this.safeSend(ws, frame(EVENTS.ONLINE_ROOM, { roomId: room, users, timestamp: now() }));
            }
        }

        const friends = await this.friendIds(me.userId);
        const onlineFriends = [];
        for (const friendId of friends) {
            const sockets = this.userSockets(friendId);
            if (!sockets.length) continue;
            onlineFriends.push(friendId);
            const payload = { userId: me.userId, status: true, timestamp: now() };
            for (const socket of sockets) {
                this.safeSend(socket, frame(EVENTS.STATUS_FRIEND, payload));
            }
        }
        this.safeSend(ws, frame(EVENTS.ONLINE_FRIENDS, { users: onlineFriends, timestamp: now() }));
    }

    async onOffline(ws) {
        const me = this.attach(ws);
        if (!me.userId) return;

        /* 还有别的连接（多标签页/多设备）时不算离线 */
        const remaining = this.userSockets(me.userId).filter(socket => socket !== ws);
        if (remaining.length) return;

        for (const room of me.rooms || []) {
            const users = this.roomUsers(room);
            if (await this.roomOnlineChanged(room, users)) {
                this.sendToRoom(room, EVENTS.ONLINE_ROOM, { roomId: room, users, timestamp: now() });
            }
        }

        const friends = await this.friendIds(me.userId);
        for (const friendId of friends) {
            const payload = { userId: me.userId, status: false, timestamp: now() };
            for (const socket of this.userSockets(friendId)) {
                this.safeSend(socket, frame(EVENTS.STATUS_FRIEND, payload));
            }
        }
    }

    /**
     * 记录并比对房间在线名单（storage 持久化，休眠不丢）。
     * 返回 true 表示名单有变化（需要广播），false 表示没变（只补发本人即可）。
     */
    async roomOnlineChanged(roomId, users) {
        const key = `ron:${roomId}`;
        const sorted = [...users].sort();
        const prev = await this.state.storage.get(key);
        if (prev && JSON.stringify(prev) === JSON.stringify(sorted)) return false;
        await this.state.storage.put(key, sorted);
        return true;
    }

    /* ==================== 消息投递 ==================== */

    onUserMessage(ws, data) {
        const me = this.attach(ws);
        const to = String((data && data.to) || '');
        if (!me.userId || !to) return;

        const payload = { ...data, from: me.userId, to, timestamp: now() };
        /* 收发双方使用同一个事件，收信人靠 from 判断发送者（不再有 message:sender 这个反向回显事件） */
        const targets = new Set([...this.userSockets(to), ...this.userSockets(me.userId)]);
        for (const socket of targets) {
            this.safeSend(socket, frame(EVENTS.MESSAGE_USER, payload));
        }
    }

    onRoomMessage(ws, data) {
        const me = this.attach(ws);
        const roomId = String((data && data.roomId) || '');
        if (!me.userId || !roomId) return;

        /* 只允许往自己已加入的房间发消息（attachment 在成员变动时由 /sync 刷新；
           被踢/退出后 rooms 会变成空数组，此时所有房间消息都要拒掉） */
        if (Array.isArray(me.rooms) && !me.rooms.includes(roomId)) return;

        const payload = { ...data, roomId, from: me.userId, timestamp: now() };
        this.sendToRoom(roomId, EVENTS.MESSAGE_ROOM, payload);
    }

    /* ==================== 语音通话信令 ==================== */

    async onCallInvite(ws, data) {
        const me = this.attach(ws);
        const calleeId = String((data && data.to) || '');
        const callerId = me.userId;

        if (!calleeId || calleeId === callerId) return this.safeSend(ws, frame(EVENTS.CALL_ERROR, { to: calleeId, reason: 'invalid', timestamp: now() }));
        if (!this.userSockets(calleeId).length) return this.safeSend(ws, frame(EVENTS.CALL_ERROR, { to: calleeId, reason: 'offline', timestamp: now() }));
        if (await this.state.storage.get(`usercall:${callerId}`)) return this.safeSend(ws, frame(EVENTS.CALL_ERROR, { to: calleeId, reason: 'busy-self', timestamp: now() }));
        if (await this.state.storage.get(`usercall:${calleeId}`)) return this.safeSend(ws, frame(EVENTS.CALL_ERROR, { to: calleeId, reason: 'busy', timestamp: now() }));

        const callId = crypto.randomUUID();
        const session = { id: callId, caller: callerId, callee: calleeId, status: 'ringing', createdAt: now(), ringAt: now() + RING_TIMEOUT };
        await this.state.storage.put(`call:${callId}`, session);
        await this.state.storage.put(`usercall:${callerId}`, callId);
        await this.state.storage.put(`usercall:${calleeId}`, callId);
        await this.scheduleAlarm(session.ringAt);

        for (const socket of this.userSockets(calleeId)) {
            this.safeSend(socket, frame(EVENTS.CALL_INCOMING, { callId, from: callerId, username: me.username, timestamp: now() }));
        }
        this.safeSend(ws, frame(EVENTS.CALL_RINGING, { callId, to: calleeId, timestamp: now() }));
    }

    async onCallAccept(ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session || session.callee !== me.userId || session.status !== 'ringing') {
            return this.safeSend(ws, frame(EVENTS.CALL_ERROR, { callId: data && data.callId, reason: 'unavailable', timestamp: now() }));
        }

        const callerSockets = this.userSockets(session.caller);
        if (!callerSockets.length) {
            await this.releaseCall(session.id);
            return this.safeSend(ws, frame(EVENTS.CALL_ENDED, { callId: session.id, reason: 'offline', timestamp: now() }));
        }

        await this.state.storage.put(`call:${session.id}`, { ...session, status: 'active', ringAt: null });
        for (const socket of callerSockets) {
            this.safeSend(socket, frame(EVENTS.CALL_ACCEPTED, { callId: session.id, from: session.callee, timestamp: now() }));
        }
    }

    async onCallReject(ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session || session.callee !== me.userId) return;
        for (const socket of this.userSockets(session.caller)) {
            this.safeSend(socket, frame(EVENTS.CALL_REJECTED, { callId: session.id, timestamp: now() }));
        }
        await this.releaseCall(session.id);
    }

    async onCallCancel(ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session || session.caller !== me.userId) return;
        for (const socket of this.userSockets(session.callee)) {
            this.safeSend(socket, frame(EVENTS.CALL_CANCELED, { callId: session.id, timestamp: now() }));
        }
        await this.releaseCall(session.id);
    }

    async onCallEnd(ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session) return;
        if (session.caller !== me.userId && session.callee !== me.userId) return;

        const peerId = session.caller === me.userId ? session.callee : session.caller;
        for (const socket of this.userSockets(peerId)) {
            this.safeSend(socket, frame(EVENTS.CALL_ENDED, { callId: session.id, reason: 'hangup', timestamp: now() }));
        }
        await this.releaseCall(session.id);
    }

    async onRtcSignal(event, ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session || session.status !== 'active') return;
        if (session.caller !== me.userId && session.callee !== me.userId) return;

        const peerId = session.caller === me.userId ? session.callee : session.caller;
        const payload = { callId: session.id, from: me.userId, sdp: data.sdp, candidate: data.candidate };
        for (const socket of this.userSockets(peerId)) {
            this.safeSend(socket, frame(event, payload));
        }
    }

    async releaseCall(callId) {
        const session = await this.state.storage.get(`call:${callId}`);
        if (session) {
            await this.state.storage.delete(`usercall:${session.caller}`);
            await this.state.storage.delete(`usercall:${session.callee}`);
        }
        await this.state.storage.delete(`call:${callId}`);
    }

    /** 只保留最近一个振铃超时闹钟，避免并发通话互相覆盖 */
    async scheduleAlarm(timestamp) {
        const current = await this.state.storage.getAlarm();
        if (current === null || timestamp < current) {
            await this.state.storage.setAlarm(timestamp);
        }
    }

    async alarm() {
        const calls = await this.state.storage.list({ prefix: 'call:' });
        const timestamp = now();
        let next = null;

        for (const [, session] of calls) {
            if (session.status !== 'ringing') continue;
            if (session.ringAt && session.ringAt <= timestamp) {
                for (const socket of this.userSockets(session.caller)) {
                    this.safeSend(socket, frame(EVENTS.CALL_TIMEOUT, { callId: session.id, timestamp }));
                }
                for (const socket of this.userSockets(session.callee)) {
                    this.safeSend(socket, frame(EVENTS.CALL_CANCELED, { callId: session.id, reason: 'timeout', timestamp }));
                }
                await this.releaseCall(session.id);
            } else if (session.ringAt && (next === null || session.ringAt < next)) {
                next = session.ringAt;
            }
        }

        if (next) await this.state.storage.setAlarm(next);
    }

    /* ==================== 基础设施 ==================== */

    attach(ws) {
        try { return ws.deserializeAttachment() || {}; } catch { return {}; }
    }

    userSockets(userId) {
        try { return this.state.getWebSockets(String(userId)); } catch { return []; }
    }

    /** 成员关系变化后置空索引，下次用到时从 attachment 重建 */
    invalidateRoomIndex() {
        this.roomIndex = null;
    }

    buildRoomIndex() {
        const index = new Map();
        for (const socket of this.state.getWebSockets()) {
            const info = this.attach(socket);
            if (!info || !info.userId || !Array.isArray(info.rooms)) continue;
            for (const room of info.rooms) {
                let set = index.get(room);
                if (!set) { set = new Set(); index.set(room, set); }
                set.add(socket);
            }
        }
        this.roomIndex = index;
        return index;
    }

    /** 某房间当前的所有连接（O(1)，首次调用会重建一次索引） */
    roomSockets(roomId) {
        const index = this.roomIndex || this.buildRoomIndex();
        const set = index.get(String(roomId));
        return set ? Array.from(set) : [];
    }

    sendToTag(tag, event, data) {
        let delivered = 0;
        let sockets = [];
        try { sockets = this.state.getWebSockets(tag); } catch { sockets = []; }
        for (const socket of sockets) {
            if (this.safeSend(socket, frame(event, data))) delivered++;
        }
        return delivered;
    }

    /** 推给某个用户的全部连接（多标签页/多设备） */
    sendToUser(userId, event, data) {
        let delivered = 0;
        for (const socket of this.userSockets(String(userId))) {
            if (this.safeSend(socket, frame(event, data))) delivered++;
        }
        return delivered;
    }

    /**
     * 推给某个房间的在线成员。
     * 用 roomIndex（来源是 attachment.rooms）而不是 socket tag 判断：
     * tag 在 accept 后不可修改，而成员可能随时被加入/移出房间，attachment 能通过 /sync 实时刷新。
     */
    sendToRoom(roomId, event, data, excludeUser) {
        const exclude = excludeUser ? String(excludeUser) : '';
        let delivered = 0;
        for (const socket of this.roomSockets(roomId)) {
            if (exclude && this.attach(socket).userId === exclude) continue;
            if (this.safeSend(socket, frame(event, data))) delivered++;
        }
        return delivered;
    }

    broadcastAll(event, data) {
        let delivered = 0;
        for (const socket of this.state.getWebSockets()) {
            if (this.safeSend(socket, frame(event, data))) delivered++;
        }
        return delivered;
    }

    safeSend(ws, payload) {
        try { ws.send(payload); return true; } catch { return false; }
    }

    /**
     * 单连接发送频率限制（滑动窗口，内存态）。
     * 只拦 send:user / send:room：刷屏会同时消耗 DO 请求与接收方的渲染资源。
     * 不持久化：DO 休眠或重连后窗口重置，够用且零成本。
     */
    overRate(ws) {
        if (!this.hits) this.hits = new Map();
        const timestamp = now();
        const list = (this.hits.get(ws) || []).filter(at => timestamp - at < RATE_WINDOW);
        if (list.length >= RATE_LIMIT) {
            this.hits.set(ws, list);
            return true;
        }
        list.push(timestamp);
        this.hits.set(ws, list);
        return false;
    }

    roomUsers(roomId) {
        const users = new Set();
        for (const socket of this.roomSockets(roomId)) {
            const info = this.attach(socket);
            if (info && info.userId) users.add(info.userId);
        }
        return Array.from(users);
    }

    async userRooms(userId) {
        const { results } = await this.env.DB
            .prepare('SELECT room_id FROM member WHERE user_id = ? AND isDeleted = 0')
            .bind(userId)
            .all();
        return (results || []).map(row => row.room_id);
    }

    async friendIds(userId) {
        const { results } = await this.env.DB
            .prepare('SELECT friend_id FROM friend WHERE creator = ? AND isDeleted = 0')
            .bind(userId)
            .all();
        return (results || []).map(row => row.friend_id);
    }
}
