import { defineStore } from 'pinia'
import { User } from './user'
import ServerApi from '@/api/index'
import { useSocketStore } from './socket'

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
        // 我加入的房间
        rooms: [] as Rooms[],

        // 我创建的房间
        roomsMine: [] as Room[],

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
        // 获取我加入的房间及房间成员
        getRooms() {
            this.getRoomsMine()
            this.getRoomAll()
        },
        // 获取我创建的房间
        getRoomsMine() {
            ServerApi.GetRoomMine().then((res:any) => {
                this.roomsMine = res.data.rows || []
            })
        },
        // 获取我加入的所有房间及房间成员
        getRoomAll() {
            const userinfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
            ServerApi.GetMemberInfo({
                user_id: userinfo.id 
            }).then((res:any) => {
                this.rooms = res.data || []
                this.rooms.forEach(room => {
                    // 获取房间成员
                    this.getRoomMember(room.room_id)
                })
            })
        },
        // 获取房间成员
        getRoomMember(room_id: string) {
            // 获取房间成员
            ServerApi.GetMemberInfo({
                room_id,
            }).then((res: any) => {
                if (res.code === 200) {
                    
                    useSocketStore().roomMemberMap.set(room_id, res.data || [])
                }
            });
        },
        // 获取某房间的待处理入群申请（房主才有）
        getRoomApplies(room_id: string) {
            if (!this.roomsMine.find(item => item.id === room_id)) {
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
            this.roomsMine = this.roomsMine.filter(item => item.id !== room_id)
            this.applyMap.delete(room_id)

            const socketStore = useSocketStore()
            socketStore.roomMemberMap.delete(room_id)
            socketStore.roomMemberOnlineMap.delete(room_id)
            socketStore.roomMessageMap.delete(room_id)
        },
        /** 房间改名等元信息变化 */
        updateRoomInfo(room: Room) {
            this.rooms.forEach(item => {
                if (item.room_id === room.id) item.room_info = room
            })
            this.roomsMine.forEach(item => {
                if (item.id === room.id) Object.assign(item, room)
            })
        }
    }
})