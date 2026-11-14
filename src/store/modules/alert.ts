import { defineStore } from 'pinia'

interface Alert {
    senderName: string
    message: string
    timestamp: string
}
export const useAlertStore = defineStore('alert', {
    state: () => ({
        // 我的申请列表
        alerts: [] as Alert[],
    }),
    getters: {

    },
    actions: {
        addAlert(alert: Alert) {
            this.alerts.push(alert)
        },
    }
})
