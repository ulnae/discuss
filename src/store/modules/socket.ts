import { defineStore } from 'pinia'
import type { Socket } from 'socket.io-client'
import { connectSocket } from '@/plugin/socket'
import { useUserStore } from './user'
import { useFriendStore } from './friend'
import { useRoomStore } from './room'
import { useAlertStore } from "./alert";
import { useApplyStore } from './apply'
import { useCallStore } from './call'
import { updateTitle } from '@/utils'
import { mergeChatMessages } from '@/utils/messageMerge'
import { MessageCache } from '@/utils/messageCache'
import { toast } from '@/components/ui/toast'
import { Event, type MentionRef } from '@/constants/events'
import { i18n } from '@/locales'

const t = i18n.global.t

const setTitle = updateTitle()

/** 当前登录账号 id：所有聊天缓存写入都带上它，实现按账号隔离 */
const currentUid = () => (useUserStore().userInfo.id as string) || ''

/** 单个会话在内存里最多保留的消息条数（IndexedDB 只留 200，内存留多一点供上翻） */
const MAX_IN_MEMORY = 500

/** 追加并裁剪，避免长会话把内存撑爆 */
function pushCapped(list: any[], message: any) {
    list.push(message)
    if (list.length > MAX_IN_MEMORY) list.splice(0, list.length - MAX_IN_MEMORY)
    return list
}

/**
 * 把一条收到的消息并入会话列表：带 clientId 的回执原地替换乐观消息，否则追加。
 *
 * 回执对账时做字段级补回：后端白名单若漏传 originalname（文件名）/ mentions（@ 成员），
 * 用本地乐观消息里的旧值补齐，避免整对象替换把这些字段抹掉（文件名退化成"下载文件"）。
 * status 是本地乐观态，回执到达即代表发送完成，始终丢弃。
 */
function upsertMessage(list: any[], data: any) {
    const { status: _drop, ...message } = data
    // 服务端回执到达：消息已被确认，清掉 ack 超时定时器
    if (data?.clientId) clearAckTimer(data.clientId)
    const optimistic = data?.clientId
        ? list.find((m: any) => m.clientId === data.clientId)
        : undefined
    if (optimistic) {
        for (const key of ['originalname', 'mentions'] as const) {
            if (message[key] === undefined && optimistic[key] !== undefined) {
                message[key] = optimistic[key]
            }
        }
    }
    const merged = mergeChatMessages(list, [message])
    list.splice(0, list.length, ...merged)
    if (list.length > MAX_IN_MEMORY) list.splice(0, list.length - MAX_IN_MEMORY)
    return list
}

/** 图片 / 文件消息的附加字段（与文字消息共用一条发送链路） */
type MessageMeta = { type?: string; size?: number; originalname?: string; mentions?: MentionRef[] }

/** 发送确认超时：超过这个时间仍是 sending 就置为 failed，避免旋转环永久卡死 */
const ACK_TIMEOUT_MS = 15000
const ackTimers = new Map<string, ReturnType<typeof setTimeout>>()
function clearAckTimer(clientId?: string) {
    if (!clientId) return
    const timer = ackTimers.get(clientId)
    if (timer) { clearTimeout(timer); ackTimers.delete(clientId) }
}

/** 当前 hash 路径（项目用 hash 路由，避免和 window.location.pathname 混淆） */
const hashPath = () => (typeof location === 'undefined' ? '' : location.hash.replace(/^#/, ''))

/**
 * 如果在某个页面（比如正被踢出的房间），就把用户送回上一级列表页。
 * 动态引入 router，避免 store ↔ router ↔ views 的循环依赖。
 */
function leaveIf(prefix: string, to: string) {
    if (!hashPath().startsWith(prefix)) return
    import('@/router')
        .then(mod => mod.default.replace(to))
        .catch(() => { /* 路由还没就绪时忽略 */ })
}

export const useSocketStore = defineStore('socket', {
    state: () => ({
        socket: null as Socket | null,
        // 用户id - 用户消息历史
        userMessageMap: new Map<string, any[]>(),
        // 房间id - 房间消息历史
        roomMessageMap: new Map<string, any[]>(),
        // 房间id - 房间成员
        roomMemberMap: new Map<string, any[]>(),
        // 房间id - 房间在线成员id
        roomMemberOnlineMap: new Map<string, Set<string>>(),
        // 房间id - 最近一次收到 online:room 推送的时间戳（供 overview 快照做新旧守卫）
        onlinePushAt: new Map<string, number>(),
        // WS 初始化就绪信号：connect + init 已发出后 resolve（见 socketReady()）
        readyPromise: null as Promise<void> | null,
        readyResolve: null as (() => void) | null,
    }),
    actions: {
        /** 清空内存中的运行时状态（切账号 / 登出时用），不碰本地持久化数据 */
        resetRuntime() {
            // 清掉所有在途 ack 定时器，避免切账号后定时器回写旧账号数据
            ackTimers.forEach(timer => clearTimeout(timer))
            ackTimers.clear()
            this.userMessageMap.clear()
            this.roomMessageMap.clear()
            this.roomMemberMap.clear()
            this.roomMemberOnlineMap.clear()
            this.onlinePushAt.clear()
            useAlertStore().alerts = []
        },

        /**
         * 启动时从 IndexedDB 恢复「当前账号」的聊天记录（刷新页面不再丢消息）。
         * 异步读取期间若账号已切换（uid 变化）则丢弃结果，避免把上一个账号的数据
         * 写进新账号的内存 Map（竞态防护）。
         */
        async hydrateMessages() {
            const uid = currentUid()
            if (!uid) return
            const { user, room, alerts } = await MessageCache.load(uid)
            if (currentUid() !== uid) return
            // load() 已把落盘残留的 sending 剥离（视为已发送成功），
            // 真正的失败以 status='failed' 落盘并原样保留，故这里无需再做状态转换。
            if (!this.userMessageMap.size) {
                user.forEach(([peerId, list]) => this.userMessageMap.set(peerId, list))
            }
            if (!this.roomMessageMap.size) {
                room.forEach(([roomId, list]) => this.roomMessageMap.set(roomId, list))
            }
            if (!useAlertStore().alerts.length && alerts.length) {
                useAlertStore().alerts = alerts
            }
        },

        /**
         * 等待 WS 初始化就绪（connect + init 已发出，服务端即将/已经把我们登记在线）。
         * 供 getRooms() 等 REST 聚合快照调用：先就绪再拉快照，避免快照不含刚上线的自己。
         * 带 5s 兜底超时：WS 一直建不起来也不阻塞页面加载。
         */
        socketReady(timeoutMs = 5000) {
            const ready = this.readyPromise || Promise.resolve()
            return Promise.race([
                ready,
                new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
            ])
        },

        /**
         * 兜底：自己已建立 WS 连接就必然在线。
         * 服务端在线快照存在竞态（overview 在 init/join 之前拍、断连清理误判等），
         * 可能把"我"标灰且没有后续事件纠正；这里强制把自己并回所有房间在线集合。
         */
        ensureSelfOnline() {
            const me = useUserStore().userInfo.id
            if (!me) return
            this.roomMemberOnlineMap.forEach(set => set.add(me as string))
        },

        initSocket() {
            // 本地消息恢复已由 getInfo() 在调用本方法前 await 完成。
            // 不要在这里 fire-and-forget 地再调 hydrateMessages()：那样回执可能在恢复完成前
            // 先写进空 Map，触发 hydrate 里的 `if (!size)` 守卫而跳过全部历史，导致消息"消失"。
            return new Promise((resolve, reject) => {
                // 重复初始化时先安静地关掉旧连接，避免同一账号挂多条 socket
                if (this.socket) {
                    try { this.socket.disconnect() } catch { /* ignore */ }
                    this.socket = null
                }
                // 重建就绪信号：connect + init 发出后 resolve，供 socketReady() 等待
                this.readyPromise = new Promise<void>(res => { this.readyResolve = res as () => void })
                // VITE_APP_RUNTIME 决定用 socket.io（server-nestjs）还是原生 WebSocket（worker）
                connectSocket(useUserStore().token).then((socket: Socket) => {
                    this.socket = socket
                    // 注册语音通话信令事件
                    useCallStore().register(this.socket as Socket)
                let initTimer: ReturnType<typeof setTimeout> | null = null
                let firstConnect = true
                this.socket.on('connect', () => {
                    console.log('connect')
                    // 兜底：连接建立即视自己在线，防止服务端快照竞态把自己标灰
                    this.ensureSelfOnline()
                    // 首次连接立刻 init；断线重连防抖 2s，避免网络抖动引发 init/在线名单风暴
                    if (initTimer) clearTimeout(initTimer)
                    const delay = firstConnect ? 0 : 2000
                    firstConnect = false
                    initTimer = setTimeout(() => {
                        if (this.socket && this.socket.connected) {
                            this.socket.emit(Event.INIT)
                            // init 已发出：此后服务端的在线快照就会包含自己，放行等待方
                            this.readyResolve?.()
                        }
                    }, delay)
                    resolve(true)
                })
                this.socket.on('disconnect', () => {
                    console.log('disconnect')
                    reject(false)
                })

                // 服务端处理某条消息失败时的回执（两个后端都发 exception，不再直接登出）
                this.socket.on(Event.EXCEPTION, (data) => {
                    console.warn('socket exception', data)
                    const key = data && data.i18nKey
                    const fallback = key && i18n.global.te(key)
                        ? t(key, (data && data.i18nParams) || {})
                        : (data && data.message)
                    toast.error(fallback || t('common.failedRetry'))
                    // 带 clientId 时把对应乐观消息置为失败，避免旋转环永久卡死
                    const clientId = data && data.clientId
                    if (clientId) {
                        clearAckTimer(clientId)
                        this.markMessageFailed(clientId)
                    }
                })


                // 接收用户消息（对方发来 / 自己发送的回显，统一在此落库）
                this.socket.on(Event.MESSAGE_USER, (data) => {
                    const me = useUserStore().userInfo.id
                    const peerId = data.from === me ? data.to : data.from
                    this.appendUserMessage(data, peerId)
                    // 自己发送的消息只做落库回执，不改浏览器标题
                    if (data.from !== me) {
                        setTitle(`${useFriendStore().getFriendMap[data.from]?.friend_info?.username}:${data.content}`)
                    }
                })

                // 接收房间消息
                this.socket.on(Event.MESSAGE_ROOM, (data) => {
                    this.appendRoomMessage(data)
                    // 自己发送的消息不改浏览器标题
                    if (data.from !== useUserStore().userInfo.id) {
                        setTitle(`${useRoomStore().getRoomMap[data.roomId]?.room_info?.name}:${data.content}`)
                    }
                })

                // 接收房间成员在线状态
                this.socket.on(Event.ONLINE_ROOM, (data) => {
                    const users = new Set<string>(data.users || [])
                    // 兜底：能收到这条推送说明自己 WS 在线，服务端名单竞态漏掉自己时强制补回
                    const me = useUserStore().userInfo.id
                    if (me) users.add(me as string)
                    this.roomMemberOnlineMap.set(data.roomId, users)
                    // 记录推送时间，供 overview 快照做"过期不覆盖"守卫
                    this.onlinePushAt.set(data.roomId, Date.now())
                })

                // 接收好友状态更新（规范事件名 status:friend，历史拼写 status:firend 已移除）
                this.socket.on(Event.STATUS_FRIEND, (data: any) => {
                    useFriendStore().setFriendStatus(data.userId, data.status)
                    setTitle(`[${useFriendStore().getFriendMap[data.userId]?.friend_info?.username}] ${data.status ? t('common.online') : t('common.offline')}`)
                })

                // 初始化获取所有在线好友
                this.socket.on(Event.ONLINE_FRIENDS, (data) => {
                    data.users.forEach((id: string) => {
                        useFriendStore().setFriendStatus(id, true)
                    })
                })

                // 被踢下线：两个后端现在都允许多端并存、不再主动发 kicked；
                // 监听保留作前向兼容（如未来做设备管理强制下线），平时不会触发。
                this.socket.on(Event.KICKED, () => {
                    useUserStore().logout();
                })

                // 系统通知（addAlert 内部已落盘，无需在此重复写）
                this.socket.on(Event.SYSTEM_ALERT, (data) => {
                    setTitle(`[${data.senderName}] ${data.message}`)
                    useAlertStore().addAlert(data)
                })

                /* ==================== 好友 / 房间 / 申请的实时同步 ====================
                   服务端在 REST 写操作完成后通过 Durable Object（或 Socket.IO 网关）
                   定向推送，客户端只做「最小增量 + 必要时拉一次」：
                     - 能直接改本地状态的（删除好友、摘掉待办）就不发请求
                     - 涉及多字段合并的（好友列表、房间列表）拉一次最新数据
                   ================================================================= */

                // 别人申请加我为好友：并入统一待办 + 右上角提示
                this.socket.on(Event.FRIEND_REQUEST, (data) => {
                    const apply = data && data.apply
                    if (!apply) return
                    useApplyStore().addPending(apply)
                    const name = apply.user_info?.username || t('ws.someone')
                    const tip = t('ws.friendRequest', { name })
                    toast.info(tip)
                    setTitle(tip)
                })

                // 我发起的申请被同意：双方好友列表都要出现对方
                this.socket.on(Event.FRIEND_ACCEPTED, (data) => {
                    const name = (data && data.username) || t('ws.peer')
                    useFriendStore().getFriends()
                    useApplyStore().getApplies(true)
                    useApplyStore().removePending(data && data.applyId)
                    toast.success(t('ws.friendAccepted', { name }))
                })

                // 我发起的申请被拒绝
                this.socket.on(Event.FRIEND_REJECTED, (data) => {
                    const name = (data && data.username) || t('ws.peer')
                    useApplyStore().getApplies(true)
                    toast.warning(t('ws.friendRejected', { name }))
                })

                // 对方直接把我加为好友（不走申请）
                this.socket.on(Event.FRIEND_ADDED, () => {
                    useFriendStore().getFriends()
                })

                // 被对方删除好友
                this.socket.on(Event.FRIEND_REMOVED, (data) => {
                    const id = data && data.userId
                    if (!id) return
                    useFriendStore().removeFriend(id)
                    toast.warning(t('ws.friendRemoved', { name: (data && data.username) || t('ws.peer') }))
                    leaveIf(`/friend/${id}`, '/friend/dashboard')
                })

                // 对方撤回了申请（好友 / 入群统一：直接从待办里摘掉）
                this.socket.on(Event.APPLY_REVOKED, (data) => {
                    useApplyStore().removePending(data && data.applyId)
                })

                // 有人申请加入我的房间：并入统一待办 + 右上角提示，房主在申请页审批
                this.socket.on(Event.ROOM_APPLY, (data) => {
                    const apply = data && data.apply
                    if (apply) useApplyStore().addPending(apply)
                    const name = (apply && apply.user_info && apply.user_info.username) || t('ws.someone')
                    const roomName = (data && data.roomName) || t('ws.unknownRoom')
                    const tip = t('ws.roomApply', { name, roomName })
                    toast.info(tip)
                    setTitle(tip)
                })

                // 我的入群申请有结果
                this.socket.on(Event.ROOM_APPLY_RESULT, (data) => {
                    const name = (data && data.roomName) || t('ws.unknownRoom')
                    if (data && data.status) {
                        useRoomStore().getRooms()
                        toast.success(t('ws.roomApplyAccepted', { name }))
                    } else {
                        toast.warning(t('ws.roomApplyRejected', { name }))
                    }
                })

                // 被拉进新房间
                this.socket.on(Event.ROOM_JOINED, (data) => {
                    useRoomStore().getRooms()
                    const name = data && data.roomName
                    if (name) toast.success(t('ws.roomJoined', { name }))
                })

                // 房间改名等元信息变化
                this.socket.on(Event.ROOM_UPDATED, (data) => {
                    if (data && data.room) useRoomStore().updateRoomInfo(data.room)
                })

                // 房间成员变化：只刷新当前房间的成员列表
                this.socket.on(Event.MEMBER_JOINED, (data) => {
                    if (!data || !data.roomId) return
                    useRoomStore().getRoomMember(data.roomId)
                    if (hashPath().startsWith(`/room/${data.roomId}`)) {
                        toast.info(t('ws.memberJoined', { name: data.username || t('ws.newMember') }))
                    }
                })

                this.socket.on(Event.MEMBER_REMOVED, (data) => {
                    if (!data || !data.roomId) return
                    useRoomStore().getRoomMember(data.roomId)
                    // 分子也要即时摘除：否则在 ONLINE_ROOM 到达前（或推送丢失时）在线人数虚高
                    const online = this.roomMemberOnlineMap.get(data.roomId)
                    if (online && data.userId) online.delete(data.userId)
                    // 操作者本人的本地流程已有 toast（已移出成员 / 你已退出），这里跳过回弹，避免重复
                    if (data.byUserId && data.byUserId === currentUid()) return
                    if (hashPath().startsWith(`/room/${data.roomId}`)) {
                        // 区分「主动退出」与「被移出」：后端 reason 为 left / kicked
                        const who = data.byUsername || t('ws.member')
                        toast.info(data.reason === 'left'
                            ? t('ws.memberLeft', { name: who })
                            : t('ws.memberKicked', { name: who }))
                    }
                })

                // 被移出房间
                this.socket.on(Event.ROOM_KICKED, (data) => {
                    const roomId = data && data.roomId
                    if (!roomId) return
                    useRoomStore().removeRoom(roomId)
                    toast.warning(t('ws.roomKicked', {
                        name: (data && data.byUsername) || t('ws.owner'),
                        roomName: (data && data.roomName) || t('ws.unknownRoom'),
                    }))
                    leaveIf(`/room/${roomId}`, '/room/dashboard')
                })

                // 自己退出房间
                this.socket.on(Event.ROOM_LEFT, (data) => {
                    const roomId = data && data.roomId
                    if (!roomId) return
                    useRoomStore().removeRoom(roomId)
                    toast.info(t('ws.roomLeft', { roomName: (data && data.roomName) || t('ws.unknownRoom') }))
                    leaveIf(`/room/${roomId}`, '/room/dashboard')
                })

                // 房间被解散
                this.socket.on(Event.ROOM_DELETED, (data) => {
                    const roomId = data && data.roomId
                    if (!roomId) return
                    useRoomStore().removeRoom(roomId)
                    leaveIf(`/room/${roomId}`, '/room/dashboard')
                    // 群主自己解散时本地流程已有 toast，跳过 WS 回弹
                    if (data.byUserId && data.byUserId === currentUid()) return
                    toast.warning(t('ws.roomDeleted', {
                        name: (data && data.byUsername) || t('ws.owner'),
                        roomName: (data && data.roomName) || t('ws.unknownRoom'),
                    }))
                })
                }).catch(error => {
                    console.error('socket connect failed', error)
                    reject(error)
                })
        })

        },
        disconnect() {
            this.socket?.disconnect()
            this.socket = null
        },

        /* ==================== 消息落库与乐观发送 ==================== */

        /** 按 clientId 在两个会话 Map 中定位消息并置为失败（服务端 EXCEPTION / ack 超时共用） */
        markMessageFailed(clientId: string) {
            const flip = (map: Map<string, any[]>, save: (uid: string, target: string, list: any[]) => void, targetKey: string) => {
                map.forEach((list, target) => {
                    const msg = list.find((m: any) => m.clientId === clientId)
                    if (!msg) return
                    msg.status = 'failed'
                    save(currentUid(), target, list)
                })
            }
            flip(this.userMessageMap, MessageCache.saveUser, 'to')
            flip(this.roomMessageMap, MessageCache.saveRoom, 'roomId')
        },

        /**
         * 上传占位消息：上传开始前先上屏一条 status=uploading 的乐观消息，
         * 上传成功后由 replaceUploadWithSend 原地转成 sending 并 emit，失败则转 failed。
         */
        addUploadingMessage(isRoom: boolean, target: string, meta: MessageMeta) {
            const clientId = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
            const connected = !!this.socket?.connected
            const targetField = isRoom ? 'roomId' : 'to'
            const message: any = {
                id: clientId,
                clientId,
                from: useUserStore().userInfo.id,
                [targetField]: target,
                content: meta.originalname || t('chat.file'),
                timestamp: Date.now(),
                ...meta,
                status: connected ? 'uploading' : 'failed',
                // 未连接时占位同样是「未完成上传」：content 只是本地文件名，
                // 必须打标记走重新上传，否则窗口期内点重试会把文件名当正文 emit。
                uploadFailed: !connected,
            }
            const map = isRoom ? this.roomMessageMap : this.userMessageMap
            const list = pushCapped(map.get(target) || [], message)
            map.set(target, list)
            if (isRoom) MessageCache.saveRoom(currentUid(), target, list)
            else MessageCache.saveUser(currentUid(), target, list)
            return clientId
        },

        /** 上传成功：把占位消息的内容替换为上传后的 URL，转 sending 并真正 emit */
        replaceUploadWithSend(isRoom: boolean, target: string, clientId: string, content: string, meta: MessageMeta) {
            const map = isRoom ? this.roomMessageMap : this.userMessageMap
            const list = map.get(target)
            const message = list?.find((m: any) => m.clientId === clientId)
            if (!message) return
            message.content = content
            Object.assign(message, meta)
            const connected = !!this.socket?.connected
            message.status = connected ? 'sending' : 'failed'
            // 内容已换成服务端 URL，不再是「只有本地文件名」的上传占位，
            // 即使未连接而停留 failed，也应走普通消息重发而非重新上传
            message.uploadFailed = false
            if (isRoom) MessageCache.saveRoom(currentUid(), target, list!)
            else MessageCache.saveUser(currentUid(), target, list!)
            if (connected) {
                const event = isRoom ? Event.SEND_ROOM : Event.SEND_USER
                const targetField = isRoom ? 'roomId' : 'to'
                this.socket!.emit(event, { [targetField]: target, content, clientId, ...meta })
                this.scheduleAck(isRoom, target, clientId)
            }
        },

        /**
         * 上传失败：占位消息置为 failed 并打标记。
         * uploadFailed 用于区别于「消息已发出但 ack 超时/服务端异常」的普通 failed——
         * 前者气泡里的内容只是本地文件名，点击重试必须重新走上传流程，
         * 绝不能走 resendMessage 把文件名当作正文 emit 出去。
         */
        failUploadingMessage(isRoom: boolean, target: string, clientId: string) {
            const map = isRoom ? this.roomMessageMap : this.userMessageMap
            const list = map.get(target)
            const message = list?.find((m: any) => m.clientId === clientId)
            if (!message) return
            message.status = 'failed'
            message.uploadFailed = true
            if (isRoom) MessageCache.saveRoom(currentUid(), target, list!)
            else MessageCache.saveUser(currentUid(), target, list!)
        },

        /** 重新上传前移除旧的失败占位消息（新一次上传会再插入一条新的占位） */
        removeMessageByClientId(isRoom: boolean, target: string, clientId: string) {
            const map = isRoom ? this.roomMessageMap : this.userMessageMap
            const list = map.get(target)
            if (!list) return
            const next = list.filter((m: any) => m.clientId !== clientId)
            map.set(target, next)
            if (isRoom) MessageCache.saveRoom(currentUid(), target, next)
            else MessageCache.saveUser(currentUid(), target, next)
        },

        /** ack 超时守卫：超时后仍是 sending 就置 failed 并提示，避免旋转环永久卡死 */
        scheduleAck(isRoom: boolean, target: string, clientId: string) {
            clearAckTimer(clientId)
            const timer = setTimeout(() => {
                ackTimers.delete(clientId)
                const map = isRoom ? this.roomMessageMap : this.userMessageMap
                const list = map.get(target)
                const message = list?.find((m: any) => m.clientId === clientId)
                if (!message || message.status !== 'sending') return
                message.status = 'failed'
                if (isRoom) MessageCache.saveRoom(currentUid(), target, list!)
                else MessageCache.saveUser(currentUid(), target, list!)
                toast.warning(t('chat.ackTimeout'))
            }, ACK_TIMEOUT_MS)
            ackTimers.set(clientId, timer)
        },

        /** 追加一条私聊消息；带 clientId 的回显会原地替换本地待确认消息 */
        appendUserMessage(data: any, peerId: string) {
            if (!data || !peerId) return
            const list = upsertMessage(this.userMessageMap.get(peerId) || [], data)
            this.userMessageMap.set(peerId, list)
            MessageCache.saveUser(currentUid(), peerId, list)
        },

        /** 追加一条房间消息；自己的消息通过 clientId 与乐观本地消息对账替换，避免重复 */
        appendRoomMessage(data: any) {
            if (!data || !data.roomId) return
            const list = upsertMessage(this.roomMessageMap.get(data.roomId) || [], data)
            this.roomMessageMap.set(data.roomId, list)
            MessageCache.saveRoom(currentUid(), data.roomId, list)
        },

        /**
         * 乐观发送的公共实现：私聊 / 群聊只差「目标字段、内存 Map、落盘方法、emit 事件」。
         * @param isRoom true=群聊，false=私聊
         * @param target 私聊为对方 id，群聊为 roomId
         */
        sendMessage(isRoom: boolean, target: string, content: string, meta: MessageMeta) {
            const clientId = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
            const connected = !!this.socket?.connected
            const targetField = isRoom ? 'roomId' : 'to'
            const message: any = {
                id: clientId,
                clientId,
                from: useUserStore().userInfo.id,
                [targetField]: target,
                content,
                timestamp: Date.now(),
                ...meta,
                status: connected ? 'sending' : 'failed',
            }
            const map = isRoom ? this.roomMessageMap : this.userMessageMap
            const list = pushCapped(map.get(target) || [], message)
            map.set(target, list)
            if (isRoom) MessageCache.saveRoom(currentUid(), target, list)
            else MessageCache.saveUser(currentUid(), target, list)
            if (connected) {
                const event = isRoom ? Event.SEND_ROOM : Event.SEND_USER
                this.socket!.emit(event, { [targetField]: target, content, clientId, ...meta })
                this.scheduleAck(isRoom, target, clientId)
            }
        },

        /** 乐观发送私聊消息：先上屏，等 message:user 回执后由 clientId 对账 */
        sendUser(receiver: string, content: string, meta: MessageMeta = {}) {
            this.sendMessage(false, receiver, content, meta)
        },

        /** 乐观发送房间消息（文字 / 图片 / 文件共用一条链路） */
        sendRoom(roomId: string, content: string, meta: MessageMeta = {}) {
            this.sendMessage(true, roomId, content, meta)
        },

        /** 重发失败的消息（气泡上点击「发送失败，点击重试」） */
        resendMessage(message: any) {
            if (!message || message.status !== 'failed') return
            if (!this.socket?.connected) {
                toast.warning(t('http.network'))
                return
            }
            message.status = 'sending'
            const meta = {
                type: message.type,
                size: message.size,
                originalname: message.originalname,
                // 失败重发也要带上 @ 元数据，否则本地缓存的消息会丢高亮
                mentions: message.mentions,
            }
            const clientId = message.clientId
            if (message.roomId) {
                this.socket.emit(Event.SEND_ROOM, { roomId: message.roomId, content: message.content, clientId, ...meta })
                this.scheduleAck(true, message.roomId, clientId)
                MessageCache.saveRoom(currentUid(), message.roomId, this.roomMessageMap.get(message.roomId) || [])
            } else if (message.to) {
                this.socket.emit(Event.SEND_USER, { to: message.to, content: message.content, clientId, ...meta })
                this.scheduleAck(false, message.to, clientId)
                MessageCache.saveUser(currentUid(), message.to, this.userMessageMap.get(message.to) || [])
            }
        },
    }
})