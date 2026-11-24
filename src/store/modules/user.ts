import { defineStore } from 'pinia'
import { useSocketStore } from './socket'
import { useFriendStore } from './friend'

import { useRoomStore } from './room'
import { useApplyStore } from './apply'
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
        /** 修改账号资料后统一更新内存与本地缓存 */
        syncProfile(patch: Partial<User>) {
            this.userInfo = { ...this.userInfo, ...patch }
            localStorage.setItem('userInfo', JSON.stringify(this.userInfo))
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
            // 清空各列表 store 的旧账号数据与 loading，回到「初始加载中」：
            // 下次登录 getInfo() 会重新拉取并复位，避免切账号瞬间闪出他人列表。
            const friendStore = useFriendStore()
            friendStore.friends = []
            friendStore.pendingStatus.clear()
            friendStore.loading = true
            const roomStore = useRoomStore()
            roomStore.rooms = []
            roomStore.loading = true
            const applyStore = useApplyStore()
            applyStore.applies = []
            applyStore.pendingApplies = []
            applyStore.pendingLoading = true
            applyStore.sentLoading = true
            applyStore.pendingFetchId = 0
            applyStore.sentFetchId = 0
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
            // 申请页两栏数据纳入全局启动链路（与好友/房间同源）：
            // 保证 pendingLoading/sentLoading 无论是否进入申请页都会被复位，
            // 同时导航角标 pendingCount 在刷新后立即拿到权威数据。
            useApplyStore().getApplies()
            useApplyStore().getPendingApplies()
            // 关键：等 WS connect + init 发出之后再拉 /room/overview 聚合快照。
            // 否则快照是在自己还没 join 房间时拍的，天然不含自己；若快照又恰好
            // 在 online:room 推送之后到达，会把正确名单覆盖成「自己离线」。
            // socketReady 自带 5s 兜底超时，WS 建不起来也不阻塞房间列表加载。
            await useSocketStore().socketReady()
            useRoomStore().getRooms()
        }

    }
})
