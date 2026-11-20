import { defineStore } from 'pinia'
import serverApi from "@/api";
import { User } from './user'
import { Room, useRoomStore } from './room'
import { useFriendStore } from './friend'


/**
 * 申请记录。好友申请与入群申请共用一张表、一个审批接口：
 *  - 有 room_id / room_info       → 入群申请（申请加入房间）
 *  - 有 apply_user_id / apply_user_info → 好友申请（申请加为好友）
 */
export interface Apply {

    id: string

    // 被申请人信息（好友申请）
    apply_user_id?: string
    apply_user_info?: User

    // 被申请房间信息（入群申请）
    room_id?: string
    room_info?: Room

    handle_status: boolean
    status: boolean

    // 申请人信息
    user_id: string
    user_info: User
    createdAt: string
    updatedAt: string
}

export const useApplyStore = defineStore('apply', {
    state: () => ({
        // 我发起的申请列表
        applies: [] as Apply[],
        // 待我审批的申请列表（好友 + 入群统一，由 GET /apply/mine 返回）
        pendingApplies: [] as Apply[],
    }),
    getters: {
        /** 该申请是否为入群申请 */
        isRoomApply: () => (apply: Apply) => !!apply.room_id,
        /** 待审批的好友申请 */
        pendingFriendApplies(state): Apply[] {
            return state.pendingApplies.filter(a => !a.room_id)
        },
        /** 待审批的入群申请 */
        pendingRoomApplies(state): Apply[] {
            return state.pendingApplies.filter(a => !!a.room_id)
        },
        /** 尚未处理的申请数量（用于导航角标 / 顶部提示） */
        pendingCount(state): number {
            return state.pendingApplies.filter(a => !a.handle_status).length
        },
    },
    actions: {
        getApplies() {
            serverApi.getApply().then((res: any) => {
                this.applies = res.data || []
            })
        },
        /** 拉取待我审批的全部申请（好友 + 入群），接口已统一 */
        getPendingApplies() {
            serverApi.GetApplyMine().then((res: any) => {
                this.pendingApplies = res.data || []
            })
        },
        /** 收到实时申请（friend:request / room:apply）：直接插到待处理列表顶部，不用重新请求 */
        addPending(apply: Apply) {
            if (!apply?.id) return
            if (this.pendingApplies.some(item => item.id === apply.id)) return
            this.pendingApplies.unshift(apply)
        },
        /** 撤回 / 已处理：把这条从待办里摘掉 */
        removePending(id: string) {
            this.pendingApplies = this.pendingApplies.filter(item => item.id !== id)
        },
        /** 审批申请（好友 / 入群共用 PATCH /apply/:id） */
        handleApply(id: string, status: boolean) {
            return serverApi.handleApply({ id, status }).then((res: any) => {
                if (res && res.code !== 200) return
                // 先本地摘掉，列表立刻响应；随后拉一次权威列表兜底
                this.removePending(id)
                this.getPendingApplies()
                // 同意后刷新：入群 → 房间列表；好友 → 好友列表
                if (status) {
                    useRoomStore().getRooms()
                    useFriendStore().getFriends()
                }
            })
        }
    }
})
