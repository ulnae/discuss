/**
 * DiscussHub —— 实时通信 Durable Object
 *
 * 替代 server-nestjs 的 Socket.IO 网关（socket.gateway.ts），事件名保持完全一致：
 *   客户端 → 服务端：init / send:user / send:room / call:* / webrtc:*
 *   服务端 → 客户端：connected / message:user / message:sender / message:room /
 *                    online:room / online:friends / status:firend / kicked / system:alert / call:*
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

const RING_TIMEOUT = 30_000;

const frame = (event, data) => JSON.stringify({ event, data });
const now = () => Date.now();

export class DiscussHub {
    constructor(state, env) {
        this.state = state;
        this.env = env;
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
            const delivered = this.sendToRoom(roomId, 'online:room', {
                room: roomId,
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
                delivered += this.sendToUser(row.friend_id, 'status:firend', {
                    friend: userId,
                    status: online,
                    timestamp: now()
                });
                if (this.userSockets(row.friend_id).length) {
                    delivered += this.sendToUser(userId, 'status:firend', {
                        friend: row.friend_id,
                        status: true,
                        timestamp: now()
                    });
                }
            }
            return Response.json({ ok: true, delivered });
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

        /* 第二个参数是 tag：可按用户、按房间批量取连接，休眠后依然有效 */
        this.state.acceptWebSocket(server, [userId, ...rooms.map(id => `room:${id}`)]);
        server.serializeAttachment({ userId, username, rooms });
        server.send(frame('connected', { userId, username, timestamp: now() }));

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

        switch (event) {
            case 'init': return this.onInit(ws);
            case 'send:user': return this.onUserMessage(ws, data);
            case 'send:room': return this.onRoomMessage(ws, data);
            case 'call:invite': return this.onCallInvite(ws, data);
            case 'call:accept': return this.onCallAccept(ws, data);
            case 'call:reject': return this.onCallReject(ws, data);
            case 'call:cancel': return this.onCallCancel(ws, data);
            case 'call:end': return this.onCallEnd(ws, data);
            case 'webrtc:offer':
            case 'webrtc:answer':
            case 'webrtc:candidate': return this.onRtcSignal(event, ws, data);
            default: return;
        }
    }

    async webSocketClose(ws) {
        await this.onOffline(ws);
    }

    async webSocketError(ws) {
        await this.onOffline(ws);
    }

    /* ==================== 上线 / 下线 ==================== */

    async onInit(ws) {
        const me = this.attach(ws);
        if (!me.userId) return;

        /* 单端登录：踢掉同一账号的其它连接（对应 NestJS 的 kicked） */
        for (const other of this.userSockets(me.userId)) {
            if (other === ws) continue;
            this.safeSend(other, frame('kicked', { reason: 'Account logged in elsewhere', timestamp: now() }));
            try { other.close(4001, 'kicked'); } catch { /* ignore */ }
        }

        /* 每次（重）连都重新读一次成员表：重连本身就是「房间订阅自愈」的时机 */
        const rooms = await this.userRooms(me.userId);
        try { ws.serializeAttachment({ ...me, rooms }); } catch { /* ignore */ }

        for (const room of rooms) {
            this.sendToRoom(room, 'online:room', { room, users: this.roomUsers(room), timestamp: now() });
        }

        const friends = await this.friendIds(me.userId);
        const onlineFriends = [];
        for (const friendId of friends) {
            const sockets = this.userSockets(friendId);
            if (!sockets.length) continue;
            onlineFriends.push(friendId);
            for (const socket of sockets) {
                this.safeSend(socket, frame('status:firend', { friend: me.userId, status: true, timestamp: now() }));
            }
        }
        this.safeSend(ws, frame('online:friends', { users: onlineFriends, timestamp: now() }));
    }

    async onOffline(ws) {
        const me = this.attach(ws);
        if (!me.userId) return;

        /* 还有别的连接（多标签页）时不算离线 */
        const remaining = this.userSockets(me.userId).filter(socket => socket !== ws);
        if (remaining.length) return;

        for (const room of me.rooms || []) {
            this.sendToRoom(room, 'online:room', { room, users: this.roomUsers(room), timestamp: now() });
        }

        const friends = await this.friendIds(me.userId);
        for (const friendId of friends) {
            for (const socket of this.userSockets(friendId)) {
                this.safeSend(socket, frame('status:firend', { friend: me.userId, status: false, timestamp: now() }));
            }
        }
    }

    /* ==================== 消息投递 ==================== */

    onUserMessage(ws, data) {
        const me = this.attach(ws);
        const receiver = String((data && data.sender) || '');
        if (!me.userId || !receiver) return;

        const payload = { ...data, sender: me.userId, receiver, timestamp: now() };
        for (const socket of this.userSockets(receiver)) {
            this.safeSend(socket, frame('message:user', payload));
        }
        this.safeSend(ws, frame('message:sender', payload));
    }

    onRoomMessage(ws, data) {
        const me = this.attach(ws);
        const room = String((data && data.room) || '');
        if (!me.userId || !room) return;

        /* 只允许往自己已加入的房间发消息（attachment 在成员变动时由 /sync 刷新；
           被踢/退出后 rooms 会变成空数组，此时所有房间消息都要拒掉） */
        if (Array.isArray(me.rooms) && !me.rooms.includes(room)) return;

        const payload = { ...data, sender: me.userId, timestamp: now() };
        this.sendToRoom(room, 'message:room', payload);
    }

    /* ==================== 语音通话信令 ==================== */

    async onCallInvite(ws, data) {
        const me = this.attach(ws);
        const calleeId = String((data && data.to) || '');
        const callerId = me.userId;

        if (!calleeId || calleeId === callerId) return this.safeSend(ws, frame('call:error', { to: calleeId, reason: 'invalid', timestamp: now() }));
        if (!this.userSockets(calleeId).length) return this.safeSend(ws, frame('call:error', { to: calleeId, reason: 'offline', timestamp: now() }));
        if (await this.state.storage.get(`usercall:${callerId}`)) return this.safeSend(ws, frame('call:error', { to: calleeId, reason: 'busy-self', timestamp: now() }));
        if (await this.state.storage.get(`usercall:${calleeId}`)) return this.safeSend(ws, frame('call:error', { to: calleeId, reason: 'busy', timestamp: now() }));

        const callId = crypto.randomUUID();
        const session = { id: callId, caller: callerId, callee: calleeId, status: 'ringing', createdAt: now(), ringAt: now() + RING_TIMEOUT };
        await this.state.storage.put(`call:${callId}`, session);
        await this.state.storage.put(`usercall:${callerId}`, callId);
        await this.state.storage.put(`usercall:${calleeId}`, callId);
        await this.scheduleAlarm(session.ringAt);

        for (const socket of this.userSockets(calleeId)) {
            this.safeSend(socket, frame('call:incoming', { callId, from: callerId, username: me.username, timestamp: now() }));
        }
        this.safeSend(ws, frame('call:ringing', { callId, to: calleeId, timestamp: now() }));
    }

    async onCallAccept(ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session || session.callee !== me.userId || session.status !== 'ringing') {
            return this.safeSend(ws, frame('call:error', { callId: data && data.callId, reason: 'unavailable', timestamp: now() }));
        }

        const callerSockets = this.userSockets(session.caller);
        if (!callerSockets.length) {
            await this.releaseCall(session.id);
            return this.safeSend(ws, frame('call:ended', { callId: session.id, reason: 'offline', timestamp: now() }));
        }

        await this.state.storage.put(`call:${session.id}`, { ...session, status: 'active', ringAt: null });
        for (const socket of callerSockets) {
            this.safeSend(socket, frame('call:accepted', { callId: session.id, from: session.callee, timestamp: now() }));
        }
    }

    async onCallReject(ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session || session.callee !== me.userId) return;
        for (const socket of this.userSockets(session.caller)) {
            this.safeSend(socket, frame('call:rejected', { callId: session.id, timestamp: now() }));
        }
        await this.releaseCall(session.id);
    }

    async onCallCancel(ws, data) {
        const me = this.attach(ws);
        const session = await this.state.storage.get(`call:${data && data.callId}`);
        if (!session || session.caller !== me.userId) return;
        for (const socket of this.userSockets(session.callee)) {
            this.safeSend(socket, frame('call:canceled', { callId: session.id, timestamp: now() }));
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
            this.safeSend(socket, frame('call:ended', { callId: session.id, reason: 'hangup', timestamp: now() }));
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
                    this.safeSend(socket, frame('call:timeout', { callId: session.id, timestamp }));
                }
                for (const socket of this.userSockets(session.callee)) {
                    this.safeSend(socket, frame('call:canceled', { callId: session.id, reason: 'timeout', timestamp }));
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
     * 用 attachment.rooms 而不是 socket tag 判断：tag 在 accept 后不可修改，
     * 而成员可能随时被加入/移出房间，attachment 能通过 /sync 实时刷新。
     */
    sendToRoom(roomId, event, data, excludeUser) {
        const room = String(roomId);
        const exclude = excludeUser ? String(excludeUser) : '';
        let delivered = 0;
        for (const socket of this.state.getWebSockets()) {
            const info = this.attach(socket);
            if (!info || !Array.isArray(info.rooms) || !info.rooms.includes(room)) continue;
            if (exclude && info.userId === exclude) continue;
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

    roomUsers(roomId) {
        const room = String(roomId);
        const users = new Set();
        for (const socket of this.state.getWebSockets()) {
            const info = this.attach(socket);
            if (!info || !info.userId) continue;
            if (!Array.isArray(info.rooms) || !info.rooms.includes(room)) continue;
            users.add(info.userId);
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
