/**
 * 本地持久化唯一入口 —— 私聊 / 群聊消息 + 系统广播（IndexedDB / localforage）。
 *
 * 【按账号隔离】所有 key 都带 userId 前缀，不同账号的数据互不干扰：
 *   u:<userId>:<peerId>      私聊会话
 *   r:<userId>:<roomId>      群聊会话
 *   sys:<userId>:alerts      系统广播
 * 因此：换账号看不到别人的记录；登出只清内存、不清本地数据，登回老账号记录仍在。
 *
 * 防抖写入：收到消息时 800ms 内的多次追加合并成一次写盘；每会话最多保留 MAX 条。
 * 旧的 store/modules/database.ts 已废弃，其存量数据由 migrateLegacy() 一次性搬迁。
 */
import localforage from 'localforage'

const store = localforage.createInstance({
    name: 'discuss-messages',
    storeName: 'messages',
})

/** 每个会话本地最多保留的消息条数 */
export const MESSAGE_CACHE_MAX = 200

/** 写节流：同一 key 800ms 内的多次追加合并成一次写盘 */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

const keyUser = (uid: string, peerId: string) => `u:${uid}:${peerId}`
const keyRoom = (uid: string, roomId: string) => `r:${uid}:${roomId}`
const keyAlerts = (uid: string) => `sys:${uid}:alerts`

function queueSave(key: string, list: any[]) {
    const trimmed = list.slice(-MESSAGE_CACHE_MAX)
    const timer = saveTimers.get(key)
    if (timer) clearTimeout(timer)
    saveTimers.set(key, setTimeout(() => {
        saveTimers.delete(key)
        store.setItem(key, trimmed).catch(() => { /* 存储失败不影响聊天 */ })
    }, 800))
}

function cancelTimer(key: string) {
    const timer = saveTimers.get(key)
    if (timer) { clearTimeout(timer); saveTimers.delete(key) }
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

/** 读取指定账号的数据（内部函数，load / exportBackup 共用，避免依赖 this） */
async function readAccount(userId: string): Promise<{
    user: [string, any[]][]; room: [string, any[]][]; alerts: any[]
}> {
    const user: [string, any[]][] = []
    const room: [string, any[]][] = []
    let alerts: any[] = []
    if (!userId) return { user, room, alerts }
    const up = `u:${userId}:`
    const rp = `r:${userId}:`
    const ap = keyAlerts(userId)
    try {
        await store.iterate((value: any, key: string) => {
            if (key === ap) {
                alerts = Array.isArray(value) ? value : []
                return
            }
            if (!Array.isArray(value)) return
            if (key.startsWith(up)) user.push([key.slice(up.length), migrate(value)])
            else if (key.startsWith(rp)) room.push([key.slice(rp.length), migrate(value)])
        })
    } catch { /* IndexedDB 不可用时静默降级为纯内存 */ }
    return { user, room, alerts }
}

/** 备份文件结构（v2）：自描述、带版本与账号归属，便于校验、防止串号导入 */
export interface ChatBackup {
    format: 'discuss-chat-backup'
    version: 2
    exportedAt: string
    owner: { id: string; username?: string }
    data: {
        users: Array<{ peerId: string; messages: any[] }>
        rooms: Array<{ roomId: string; messages: any[] }>
        alerts: any[]
    }
}

export const MessageCache = {
    /** 恢复指定账号的全部会话；不传 userId 返回空。 */
    load(userId: string) {
        return readAccount(userId)
    },

    saveUser(userId: string, peerId: string, list: any[]) {
        if (userId) queueSave(keyUser(userId, peerId), list)
    },

    saveRoom(userId: string, roomId: string, list: any[]) {
        if (userId) queueSave(keyRoom(userId, roomId), list)
    },

    saveAlerts(userId: string, list: any[]) {
        if (userId) queueSave(keyAlerts(userId), list)
    },

    removeRoom(userId: string, roomId: string) {
        const key = keyRoom(userId, roomId)
        cancelTimer(key)
        return store.removeItem(key).catch(() => { /* ignore */ })
    },

    removeUser(userId: string, peerId: string) {
        const key = keyUser(userId, peerId)
        cancelTimer(key)
        return store.removeItem(key).catch(() => { /* ignore */ })
    },

    /** 只清空指定账号的本地数据（其它账号不受影响） */
    async clear(userId: string) {
        const up = `u:${userId}:`
        const rp = `r:${userId}:`
        const ap = keyAlerts(userId)
        for (const key of [...saveTimers.keys()]) {
            if (key.startsWith(up) || key.startsWith(rp) || key === ap) cancelTimer(key)
        }
        try {
            const doomed: string[] = []
            await store.iterate((_value: any, key: string) => {
                if (key.startsWith(up) || key.startsWith(rp) || key === ap) doomed.push(key)
            })
            await Promise.all(doomed.map(key => store.removeItem(key)))
        } catch { /* ignore */ }
    },

    /** 清空全部账号数据（调试 / 隐私场景使用，正常登出不要调用） */
    clearAll() {
        saveTimers.forEach(timer => clearTimeout(timer))
        saveTimers.clear()
        return store.clear().catch(() => { /* ignore */ })
    },

    /**
     * 一次性搬迁旧版 store/modules/database.ts 的存量数据到当前账号分区。
     * 旧库：localforage(name=location.hostname, storeName=userId)，
     * key 为 User_Message / Room_Message / Alert_Message（整张 Map / 数组）。
     * 只在该账号尚无数据时写入，绝不覆盖较新数据；每个用户只跑一次。
     */
    async migrateLegacy(userId: string) {
        if (!userId || typeof localStorage === 'undefined') return
        const flag = `discuss:legacy-msg-migrated:${userId}`
        if (localStorage.getItem(flag)) return
        try {
            const legacy = localforage.createInstance({
                driver: localforage.INDEXEDDB,
                name: location.hostname,
                version: 1.0,
                storeName: userId,
            })
            const entriesOf = (v: any): [string, any[]][] => {
                if (!v) return []
                if (v instanceof Map) return [...v.entries()] as [string, any[]][]
                if (typeof v === 'object') return Object.entries(v) as [string, any[]][]
                return []
            }
            const userEntries = entriesOf(await legacy.getItem('User_Message'))
            const roomEntries = entriesOf(await legacy.getItem('Room_Message'))
            const alerts = await legacy.getItem<any[]>('Alert_Message')

            for (const [peerId, list] of userEntries) {
                const key = keyUser(userId, peerId)
                if (!Array.isArray(list) || await store.getItem(key)) continue
                await store.setItem(key, list.slice(-MESSAGE_CACHE_MAX))
            }
            for (const [roomId, list] of roomEntries) {
                const key = keyRoom(userId, roomId)
                if (!Array.isArray(list) || await store.getItem(key)) continue
                await store.setItem(key, list.slice(-MESSAGE_CACHE_MAX))
            }
            if (Array.isArray(alerts) && alerts.length && !(await store.getItem(keyAlerts(userId)))) {
                await store.setItem(keyAlerts(userId), alerts.slice(-MESSAGE_CACHE_MAX))
            }
            localStorage.setItem(flag, '1')
        } catch { /* 迁移失败不影响启动，静默降级 */ }
    },

    /** 导出指定账号的备份（新 v2 结构，自描述 + 账号归属） */
    async exportBackup(userId: string, username = ''): Promise<ChatBackup> {
        const { user, room, alerts } = await readAccount(userId)
        return {
            format: 'discuss-chat-backup',
            version: 2,
            exportedAt: new Date().toISOString(),
            owner: { id: userId, username },
            data: {
                users: user.map(([peerId, messages]) => ({ peerId, messages })),
                rooms: room.map(([roomId, messages]) => ({ roomId, messages })),
                alerts,
            },
        }
    },

    /**
     * 解析并导入备份到指定账号：校验格式/版本/账号归属，防止把他人记录导入当前账号。
     * 写盘后立即返回内存所需的数据结构，供调用方合并进 Pinia。
     */
    async importBackup(userId: string, text: string): Promise<{
        user: [string, any[]][]; room: [string, any[]][]; alerts: any[]
    }> {
        let parsed: any
        try {
            parsed = JSON.parse(text)
        } catch {
            throw new Error('文件内容不是有效的 JSON 格式')
        }
        if (!parsed || parsed.format !== 'discuss-chat-backup') {
            throw new Error('不是 Discuss 聊天记录备份文件')
        }
        if (parsed.version !== 2) {
            throw new Error(`不支持的备份版本：${parsed.version}`)
        }
        if (!parsed.owner || parsed.owner.id !== userId) {
            throw new Error('该备份属于其他账号，不能导入当前账号')
        }
        const d = parsed.data || {}
        const users = Array.isArray(d.users) ? d.users : []
        const rooms = Array.isArray(d.rooms) ? d.rooms : []
        const alerts = Array.isArray(d.alerts) ? d.alerts : []

        const user: [string, any[]][] = []
        const room: [string, any[]][] = []
        for (const it of users) {
            if (it && typeof it.peerId === 'string' && Array.isArray(it.messages)) {
                queueSave(keyUser(userId, it.peerId), migrate(it.messages))
                user.push([it.peerId, migrate(it.messages)])
            }
        }
        for (const it of rooms) {
            if (it && typeof it.roomId === 'string' && Array.isArray(it.messages)) {
                queueSave(keyRoom(userId, it.roomId), migrate(it.messages))
                room.push([it.roomId, migrate(it.messages)])
            }
        }
        if (alerts.length) {
            queueSave(keyAlerts(userId), alerts)
        }
        return { user, room, alerts }
    }
}
