import { defineStore } from 'pinia'
import serverApi from "@/api";
import { User } from './user'
import { Room, useRoomStore } from './room'
import { useFriendStore } from './friend'



interface Apply {

    id: string

    // 被申请人信息
    apply_user_id?: string
    apply_user_info?: User



    // 被申请房间信息
    room_id?: string
    room_info ?: Room


    handle_status: boolean
    status: boolean

    // 申请人信息
    user_id :string
    user_info: User
    createdAt: string
    updatedAt:string

}

export const useApplyStore = defineStore('apply', {
    state: () => ({
        // 我的申请列表
        applies: [] as Apply[],
        // 待审核申请列表
        pendingApplies: [] as Apply[],
    }),
    getters: {

    },
    actions: {
        getApplies() {
            serverApi.getApply().then((res: any) => {
                this.applies = res.data
            })
        },
        getPendingApplies() {
            serverApi.GetApplyMine().then((res: any) => {
                this.pendingApplies = res.data || []
            })
        },
        /** 收到实时好友申请：直接插到待处理列表顶部，不用重新请求 */
        addPending(apply: any) {
            if (!apply?.id) return
            if (this.pendingApplies.some(item => item.id === apply.id)) return
            this.pendingApplies.unshift(apply)
        },
        /** 撤回 / 已处理：把这条从待办里摘掉 */
        removePending(id: string) {
            this.pendingApplies = this.pendingApplies.filter(item => item.id !== id)
        },
        // 处理申请
        handleApply(id: string, status: boolean) {
            serverApi.handleApply({ id, status }).then((res: any) => {
                // 处理成功后，刷新待审核申请列表
                this.getPendingApplies()
                // 处理成功后，刷新房间列表和好友列表
                status && useRoomStore().getRooms()
                status && useFriendStore().getFriends()
            })
        }
    }
})
