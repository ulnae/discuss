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
import { toast } from '@/components/ui/toast'

const setTitle = updateTitle()

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
    }),
    actions: {
        initSocket() {
            const { userInfo } = useUserStore()
            return new Promise((resolve, reject) => {
                // 重复初始化时先安静地关掉旧连接，避免同一账号挂多条 socket
                if (this.socket) {
                    try { this.socket.disconnect() } catch { /* ignore */ }
                    this.socket = null
                }
                // VITE_APP_RUNTIME 决定用 socket.io（server-nestjs）还是原生 WebSocket（worker）
                this.socket = connectSocket(useUserStore().token) as Socket
                // 注册语音通话信令事件
                useCallStore().register(this.socket as Socket)
                this.socket.on('connect', () => {
                    console.log('connect')
                    this.socket && this.socket.emit('init')
                    resolve(true)
                })
                this.socket.on('disconnect', () => {
                    console.log('disconnect')
                    reject(false)
                })

                // 异常处理
                this.socket.on('exception', (data) => {
                    console.log(data)
                    useUserStore().logout()
                    reject(false)
                })


                // 接收用户消息
                this.socket.on('message:user', (data) => {
                    const senderMessages = this.userMessageMap.get(data.sender)
                    const messages = senderMessages || []
                    messages.push(data)
                    if (!senderMessages) this.userMessageMap.set(data.sender, messages)
                    setTitle(`${useFriendStore().getFriendMap[data.sender]?.friend_info?.username}:${data.content}`)
                })

                // 接收已发送回显信息
                this.socket.on('message:sender', (data) => {
                    const receiverMessages = this.userMessageMap.get(data.receiver)
                    const messages = receiverMessages || []
                    messages.push(data)
                    if (!receiverMessages) this.userMessageMap.set(data.receiver, messages)
                })

                // 接收房间消息
                this.socket.on('message:room', (data) => {
                    const roomMessages = this.roomMessageMap.get(data.room)
                    const messages = roomMessages || []
                    messages.push(data)
                    if (!roomMessages) this.roomMessageMap.set(data.room, messages)
                    setTitle(`${useRoomStore().getRoomMap[data.room]?.room_info?.name}:${data.content}`)
                })

                // 接收房间成员在线状态
                this.socket.on('online:room', (data) => {
                    this.roomMemberOnlineMap.set(data.room, new Set(data.users || []))
                })

                // 接收好友状态更新
                this.socket.on('status:firend', (data) => {
                    useFriendStore().setFriendStatus(data.friend, data.status)
                    setTitle(`[${useFriendStore().getFriendMap[data.friend]?.friend_info?.username}] ${data.status ? '上线' : '离线'}`)
                })

                // 初始化获取所有在线好友
                this.socket.on('online:friends', (data) => {
                    data.users.forEach((id: string) => {
                        useFriendStore().setFriendStatus(id, true)
                    })
                })

                // 异地登录-被踢下线
                this.socket.on('kicked', (data) => {
                    useUserStore().logout();
                })

                // 系统通知
                this.socket.on('system:alert', (data) => {
                    setTitle(`[${data.sender}] ${data.message}`)
                    useAlertStore().addAlert(data)
                })

                /* ==================== 好友 / 房间 / 申请的实时同步 ====================
                   服务端在 REST 写操作完成后通过 Durable Object（或 Socket.IO 网关）
                   定向推送，客户端只做「最小增量 + 必要时拉一次」：
                     - 能直接改本地状态的（删除好友、摘掉待办）就不发请求
                     - 涉及多字段合并的（好友列表、房间列表）拉一次最新数据
                   ================================================================= */

                // 别人申请加我为好友
                this.socket.on('friend:request', (data) => {
                    const apply = data && data.apply
                    if (!apply) return
                    useApplyStore().addPending(apply)
                    const name = apply.user_info?.username || '有人'
                    toast.info(`${name} 申请加你为好友`)
                    setTitle(`${name} 申请加你为好友`)
                })

                // 我发起的申请被同意：双方好友列表都要出现对方
                this.socket.on('friend:accepted', (data) => {
                    const name = (data && data.user && data.user.username) || '对方'
                    useFriendStore().getFriends()
                    useApplyStore().getApplies()
                    useApplyStore().removePending(data && data.applyId)
                    toast.success(`${name} 通过了你的好友申请`)
                })

                // 我发起的申请被拒绝
                this.socket.on('friend:rejected', (data) => {
                    const name = (data && data.user && data.user.username) || '对方'
                    useApplyStore().getApplies()
                    toast.warning(`${name} 拒绝了你的好友申请`)
                })

                // 对方直接把我加为好友（不走申请）
                this.socket.on('friend:added', () => {
                    useFriendStore().getFriends()
                })

                // 被对方删除好友
                this.socket.on('friend:removed', (data) => {
                    const id = data && data.userId
                    if (!id) return
                    useFriendStore().removeFriend(id)
                    toast.warning(`${(data && data.username) || '对方'} 已将你删除好友`)
                    leaveIf(`/friend/${id}`, '/friend/dashboard')
                })

                // 对方撤回了申请
                this.socket.on('apply:revoked', (data) => {
                    useApplyStore().removePending(data && data.applyId)
                    if (data && data.roomId) useRoomStore().getRoomApplies(data.roomId)
                })

                // 有人申请加入我的房间
                this.socket.on('room:apply', (data) => {
                    const roomId = data && data.apply && data.apply.room_id
                    if (roomId) useRoomStore().getRoomApplies(roomId)
                    const name = (data && data.apply && data.apply.user_info && data.apply.user_info.username) || '有人'
                    toast.info(`${name} 申请加入「${(data && data.room && data.room.name) || '房间'}」`)
                })

                // 我的入群申请有结果
                this.socket.on('room:apply:result', (data) => {
                    const name = (data && data.room && data.room.name) || '房间'
                    if (data && data.status) {
                        useRoomStore().getRooms()
                        toast.success(`已加入「${name}」`)
                    } else {
                        toast.warning(`加入「${name}」的申请被拒绝`)
                    }
                })

                // 被拉进新房间
                this.socket.on('room:joined', (data) => {
                    useRoomStore().getRooms()
                    const name = data && data.room && data.room.name
                    if (name) toast.success(`你已加入「${name}」`)
                })

                // 房间改名等元信息变化
                this.socket.on('room:updated', (data) => {
                    if (data && data.room) useRoomStore().updateRoomInfo(data.room)
                })

                // 房间成员变化：只刷新当前房间的成员列表
                this.socket.on('member:joined', (data) => {
                    if (!data || !data.roomId) return
                    useRoomStore().getRoomMember(data.roomId)
                    if (hashPath().startsWith(`/room/${data.roomId}`)) {
                        const name = (data.member && data.member.username) || '新成员'
                        toast.info(`${name} 加入了房间`)
                    }
                })

                this.socket.on('member:removed', (data) => {
                    if (!data || !data.roomId) return
                    useRoomStore().getRoomMember(data.roomId)
                    if (hashPath().startsWith(`/room/${data.roomId}`)) {
                        const name = (data.by && data.by.username) || '群主'
                        toast.info(`${name} 移出了一名成员`)
                    }
                })

                // 被移出房间
                this.socket.on('room:kicked', (data) => {
                    const roomId = data && data.roomId
                    if (!roomId) return
                    useRoomStore().removeRoom(roomId)
                    toast.warning(`你已被移出「${(data && data.roomName) || '房间'}」`)
                    leaveIf(`/room/${roomId}`, '/room/dashboard')
                })

                // 自己退出房间
                this.socket.on('room:left', (data) => {
                    const roomId = data && data.roomId
                    if (!roomId) return
                    useRoomStore().removeRoom(roomId)
                    toast.info(`你已退出「${(data && data.roomName) || '房间'}」`)
                    leaveIf(`/room/${roomId}`, '/room/dashboard')
                })

                // 房间被解散
                this.socket.on('room:deleted', (data) => {
                    const roomId = data && data.roomId
                    if (!roomId) return
                    useRoomStore().removeRoom(roomId)
                    toast.warning(`「${(data && data.roomName) || '房间'}」已被群主解散`)
                    leaveIf(`/room/${roomId}`, '/room/dashboard')
                })
            })

        },
        disconnect() {
            this.socket?.disconnect()
            this.socket = null
        }
    }
})