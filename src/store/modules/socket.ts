import { defineStore } from 'pinia'
import { io, Socket } from 'socket.io-client'
import { useUserStore } from './user'
import { useFriendStore } from './friend'
import { useRoomStore } from './room'
import { useAlertStore } from "./alert";
import { useCallStore } from './call'
import { updateTitle } from '@/utils'

const setTitle = updateTitle()

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
                this.socket = io(import.meta.env.VITE_APP_API_BASE_URL, {
                    path: '/websocket',
                    transports: ['websocket'],
                    auth: {
                        token: useUserStore().token
                    },
                })
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
            })

        },
        disconnect() {
            this.socket?.disconnect()
            this.socket = null
        }
    }
})