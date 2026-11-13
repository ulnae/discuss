import { defineStore } from 'pinia'
import { useSocketStore } from './socket'
import { useFriendStore } from './friend'
import { useDBStore } from './database'

import { useRoomStore } from './room'
import { MessageCache } from '@/utils/messageCache'
import router from '@/router'
import userApi from '@/api/user'
export interface User {
    createdAt?: string
    email?: string
    id?: string
    updatedAt?: string
    username?: string
    token_type?: string
    access_token?: string
}


export const useUserStore = defineStore('user', {
    state: () => ({
        isLogin: false,
        token: '',
        userInfo: {} as User,
    }),
    getters: {
        getToken: (state) => state.token,
    },
    actions: {
        async login(data: User) {
            return new Promise(async (resolve, reject) => {
                this.isLogin = true;
                this.token = data.access_token as string
                this.userInfo = data
                localStorage.setItem('token', data.access_token as string)
                localStorage.setItem('userInfo', JSON.stringify(data))
                this.getInfo()
                resolve(true)
            })

        },
        logout() {
            this.isLogin = false;
            this.token = ''
            this.userInfo = {}
            localStorage.removeItem('token')
            localStorage.removeItem('userInfo')
            useSocketStore().disconnect()
            // 登出清空本地消息缓存（新账号登录不应看到上一个账号的记录）
            MessageCache.clear()
            router.push({
                name: 'login',
            })
        },
        async init() {
            this.token = localStorage.getItem('token') || ''
            this.userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
            this.isLogin = this.token !== ''
            this.isLogin && this.getInfo()
        },

        async getInfo() {
            useSocketStore().initSocket()
            useFriendStore().getFriends()
            useRoomStore().getRooms()
            useDBStore().initDB(this.userInfo.id as string)
        }

    }
})
