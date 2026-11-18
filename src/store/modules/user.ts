import { defineStore } from 'pinia'
import { useSocketStore } from './socket'
import { useFriendStore } from './friend'

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
            // 只断开连接并清空内存运行时；本地聊天记录按账号隔离保留，
            // 这样换账号看不到他人数据，登回老账号数据仍在。
            useSocketStore().disconnect()
            useSocketStore().resetRuntime()
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
            const uid = this.userInfo.id as string
            // 先清空内存运行时，防止上一个账号的消息残留到新账号
            useSocketStore().resetRuntime()
            // 把旧 database store 的存量聊天记录一次性搬到 MessageCache（不覆盖新数据）
            await MessageCache.migrateLegacy(uid)
            useSocketStore().initSocket()
            useFriendStore().getFriends()
            useRoomStore().getRooms()
        }

    }
})
