import { defineStore } from 'pinia'
import { User } from './user'
import ServerApi from '@/api/index'

interface Friend {
    createdAt: string
    creator: string
    friend_id: string
    friend_info: User
    id: string
    user_info: User
    status?: boolean
}
export const useFriendStore = defineStore('friend', {
    state: () => ({
        friends: [] as Friend[],

        /** 好友列表里还没有这个人时收到的在线状态（同意申请瞬间事件可能先于列表刷新到达），先缓存 */
        pendingStatus: new Map<string, boolean>(),
    }),
    getters: {
        getFriendMap: (state) => {
            return state.friends.reduce((prev, cur) => {
                prev[cur.friend_info.id as string] = cur
                return prev
            }, {} as Record<string, Friend>)
        },

    },
    actions: {
        getFriends() {
            return new Promise((resolve, reject) => {
                ServerApi.GetFriends().then((res:any) => {
                    const old = this.getFriendMap
                    this.friends = (res.data || []).map((item:any) => ({
                        ...item,
                        // REST 列表不返回在线状态：沿用本地已知状态，
                        // 否则重新拉取（如同意好友申请后）会把在线好友全部刷成离线
                        status: old[item.friend_info?.id]?.status ?? this.pendingStatus.get(item.friend_info?.id) ?? item.status
                    }))
                    this.pendingStatus.clear()
                    resolve(res.data)
                }).catch(reject)
            })
        },
        setFriendStatus(id: string, status: boolean) {
            const friend = this.getFriendMap[id]
            if (friend) friend.status = status
            else this.pendingStatus.set(id, status)
        },
        /** 对方删除好友 / 自己被删除后，把这条关系从列表里摘掉 */
        removeFriend(id: string) {
            this.friends = this.friends.filter(item => item.friend_info.id !== id)
            this.pendingStatus.delete(id)
        }
    }
})