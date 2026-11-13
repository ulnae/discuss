import { defineStore } from 'pinia'
import { User } from './user'
import ServerApi from '@/api/index'
import { useSocketStore } from './socket'
import { useUserStore } from './user'
import { MessageCache } from '@/utils/messageCache'

export interface Room {
    createdAt: string
    creator: string
    description: string
    id: string
    name: string
    updatedAt: string
    user_info: User
}

export interface Rooms {
    id: string
    room_id: string
    room_info: Room
    user_id: string
    user_info: User
    createdAt: string
}
export const useRoomStore = defineStore('room', {
    state: () => ({
        // 我加入的房间（房间信息单一来源，不再维护第二份「我创建的」列表）
        rooms: [] as Rooms[],

        // 房间 id - 待处理的入群申请（供房间页实时刷新）
        applyMap: new Map<string, any[]>(),
    }),
    getters: {
        getRoomMap: (state) => {
            return state.rooms.reduce((prev, cur) => {
                prev[cur.room_id] = cur
                return prev
            }, {} as Record<string, Rooms>)
        },

    },
    actions: {
        // 我是否是某房间的群主（房间信息以 rooms 里的 room_info.creator 为准）
        isOwnerOf(room_id: string) {
            const userinfo = useUserStore().userInfo
            return !!this.rooms.find(
                item => item.room_id === room_id && item.room_info.creator === userinfo.id
            )
        },
        // 获取我加入的房间、成员与在线名单 —— 单个聚合接口，替代原来的 3+N 个请求
        getRooms() {
            const userinfo = useUserStore().userInfo
            return ServerApi.GetRoomOverview().then((res: any) => {
                if (res.code !== 200) return
                const data = res.data || {}
                const socketStore = useSocketStore()
                this.rooms = (data.rooms || []).map((room: any) => ({
                    id: room.id,
                    room_id: room.id,
                    room_info: room,
                    user_id: userinfo.id,
                    createdAt: room.createdAt,
                }))
                socketStore.roomMemberMap.clear()
                Object.entries(data.members || {}).forEach(([room_id, list]) => {
                    socketStore.roomMemberMap.set(room_id, list as any[])
                })
                socketStore.roomMemberOnlineMap.clear()
                Object.entries(data.online || {}).forEach(([room_id, users]) => {
                    socketStore.roomMemberOnlineMap.set(room_id, new Set(users as string[]))
                })
            })
        },
        // 获取单个房间的成员（成员变动事件后的定点刷新）
        getRoomMember(room_id: string) {
            ServerApi.GetMemberInfo({
                room_id,
            }).then((res: any) => {
                if (res.code === 200) {
                    useSocketStore().roomMemberMap.set(room_id, res.data || [])
                }
            });
        },
        // 获取某房间的待处理入群申请（群主才有）
        getRoomApplies(room_id: string) {
            if (!this.isOwnerOf(room_id)) {
                this.applyMap.set(room_id, [])
                return
            }
            ServerApi.getApplyRoom(room_id).then((res: any) => {
                if (res.code === 200) this.applyMap.set(room_id, res.data || [])
            })
        },
        /** 被踢出 / 房间解散：把房间和它的缓存一起清掉 */
        removeRoom(room_id: string) {
            this.rooms = this.rooms.filter(item => item.room_id !== room_id)
            this.applyMap.delete(room_id)

            const socketStore = useSocketStore()
            socketStore.roomMemberMap.delete(room_id)
            socketStore.roomMemberOnlineMap.delete(room_id)
            socketStore.roomMessageMap.delete(room_id)
            MessageCache.removeRoom(room_id)
        },
        /** 房间改名等元信息变化 */
        updateRoomInfo(room: Room) {
            this.rooms.forEach(item => {
                if (item.room_id === room.id) item.room_info = room
            })
        }
    }
})
