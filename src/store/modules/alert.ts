import { defineStore } from 'pinia'
import { useUserStore } from './user'
import { MessageCache } from '@/utils/messageCache'

interface Alert {
    senderName: string
    message: string
    /** 后端下发的是 Date.now() 毫秒时间戳 */
    timestamp: number
}

/** 通知列表变更后立即落盘到当前账号（IndexedDB 按账号隔离） */
function persist(list: Alert[]) {
    const uid = (useUserStore().userInfo.id as string) || ''
    if (uid) MessageCache.saveAlerts(uid, list)
}

export const useAlertStore = defineStore('alert', {
    state: () => ({
        // 数组顺序即展示顺序：最新在最前
        alerts: [] as Alert[],
    }),
    actions: {
        /** 新通知插到头部（最新在上），随即落盘 */
        addAlert(alert: Alert) {
            this.alerts.unshift(alert)
            persist(this.alerts)
        },
        /** 删除指定位置的通知并落盘，避免刷新后「复活」 */
        removeAlert(index: number) {
            this.alerts.splice(index, 1)
            persist(this.alerts)
        },
        /** 导入备份：调用方先合并去重，这里统一按时间降序并落盘 */
        replaceAlerts(list: Alert[]) {
            this.alerts = [...list].sort((a, b) => b.timestamp - a.timestamp)
            persist(this.alerts)
        },
    }
})
