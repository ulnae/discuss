import { defineStore } from 'pinia'
import { useSocketStore } from './socket'
import { useFriendStore } from './friend'

import { useRoomStore } from './room'
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
            // 先清空内存运行时，防止上一个账号的消息残留到新账号
            useSocketStore().resetRuntime()
            // 关键：先把本地聊天记录恢复到内存，再建立 socket 连接。
            // 若顺序颠倒，回执可能在恢复完成前写入空 Map，导致 hydrate 的 `if (!size)`
            // 守卫跳过全部历史，表现为「刷新后消息消失」。await 保证恢复完才收消息。
            await useSocketStore().hydrateMessages()
            useSocketStore().initSocket()
            useFriendStore().getFriends()
            useRoomStore().getRooms()
        }

    }
})
