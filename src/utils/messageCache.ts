/**
 * 消息本地持久化 —— 纯前端方案（IndexedDB / localforage）。
 *
 * 刷新页面后聊天记录不再丢失：socket store 收到消息时防抖写入，
 * 启动时一次性恢复。每个会话只保留最近 MAX 条，控制存储体积。
 */
import localforage from 'localforage'

const store = localforage.createInstance({
    name: 'discuss-messages',
    storeName: 'messages',
})

/** 每个会话本地最多保留的消息条数 */
export const MESSAGE_CACHE_MAX = 200

/** 写节流：同一条会话 800ms 内的多次追加合并成一次写盘 */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function queueSave(key: string, list: any[]) {
    const trimmed = list.slice(-MESSAGE_CACHE_MAX)
    const timer = saveTimers.get(key)
    if (timer) clearTimeout(timer)
    saveTimers.set(key, setTimeout(() => {
        saveTimers.delete(key)
        store.setItem(key, trimmed).catch(() => { /* 存储失败不影响聊天 */ })
    }, 800))
}

/** 旧版本消息字段（sender/receiver/room）迁移到新契约的 from/to/roomId */
function migrate(list: any[]) {
    return list.map(item => {
        if (!item || typeof item !== 'object') return item
        if (item.from === undefined && item.sender !== undefined) {
            item.from = item.sender
            delete item.sender
        }
        if (item.to === undefined && item.receiver !== undefined) {
            item.to = item.receiver
            delete item.receiver
        }
        if (item.roomId === undefined && item.room !== undefined) {
            item.roomId = item.room
            delete item.room
        }
        // 上次退出时还在「发送中」的消息已经没有回执了，标记失败让用户可重发
        if (item.status === 'sending') item.status = 'failed'
        return item
    })
}

export const MessageCache = {
    /** 启动时恢复全部会话：{ user: [[peerId, messages]], room: [[roomId, messages]] } */
    async load(): Promise<{ user: [string, any[]][]; room: [string, any[]][] }> {
        const user: [string, any[]][] = []
        const room: [string, any[]][] = []
        try {
            await store.iterate((value: any, key: string) => {
                if (!Array.isArray(value)) return
                if (key.startsWith('u:')) user.push([key.slice(2), migrate(value)])
                else if (key.startsWith('r:')) room.push([key.slice(2), migrate(value)])
            })
        } catch { /* IndexedDB 不可用时静默降级为纯内存 */ }
        return { user, room }
    },

    saveUser(peerId: string, list: any[]) {
        queueSave('u:' + peerId, list)
    },

    saveRoom(roomId: string, list: any[]) {
        queueSave('r:' + roomId, list)
    },

    removeRoom(roomId: string) {
        const key = 'r:' + roomId
        const timer = saveTimers.get(key)
        if (timer) { clearTimeout(timer); saveTimers.delete(key) }
        return store.removeItem(key).catch(() => { /* ignore */ })
    },

    removeUser(peerId: string) {
        const key = 'u:' + peerId
        const timer = saveTimers.get(key)
        if (timer) { clearTimeout(timer); saveTimers.delete(key) }
        return store.removeItem(key).catch(() => { /* ignore */ })
    },

    /** 登出时清空本地消息 */
    clear() {
        saveTimers.forEach(timer => clearTimeout(timer))
        saveTimers.clear()
        return store.clear().catch(() => { /* ignore */ })
    }
}
