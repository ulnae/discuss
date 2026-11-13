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
                    this.friends = res.data || []
                    resolve(res.data)
                }).catch(reject)
            })
        },
        setFriendStatus(id: string, status: boolean) {
            const friend = this.getFriendMap[id]
            if (friend) friend.status = status
        },
        /** 对方删除好友 / 自己被删除后，把这条关系从列表里摘掉 */
        removeFriend(id: string) {
            this.friends = this.friends.filter(item => item.friend_info.id !== id)
        }
    }
})