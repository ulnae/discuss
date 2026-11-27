/**
 * 本地持久化唯一入口 —— 私聊 / 群聊消息 + 系统广播（IndexedDB / localforage）。
 *
 * 【按账号隔离】所有 key 都带 userId 前缀，不同账号的数据互不干扰：
 *   u:<userId>:<peerId>      私聊会话
 *   r:<userId>:<roomId>      群聊会话
 *   sys:<userId>:alerts      系统广播
 * 因此：换账号看不到别人的记录；登出只清内存、不清本地数据，登回老账号记录仍在。
 *
 * 即时写入：消息一上屏就落盘（按会话串行），避免「发完立刻刷新」时防抖定时器未触发而丢消息；
 * 每会话最多保留 MAX 条。
 */
import localforage from 'localforage'
import { i18n } from '@/locales'

const t = i18n.global.t

const store = localforage.createInstance({
    name: 'discuss-messages',
    storeName: 'messages',
})

/** 每个会话本地最多保留的消息条数 */
const MESSAGE_CACHE_MAX = 200

const keyUser = (uid: string, peerId: string) => `u:${uid}:${peerId}`
const keyRoom = (uid: string, roomId: string) => `r:${uid}:${roomId}`
const keyAlerts = (uid: string) => `sys:${uid}:alerts`

/**
 * 每个 key 的串行写链。
 *
 * 【为什么不用防抖】原来用 800ms 防抖合并写入，但用户「发完消息立刻刷新/关闭页面」时，
 * 定时器还没触发页面就销毁了，消息从未落盘 —— 表现为刷新后消息凭空消失。
 * 改为消息一上屏就立即发起写盘，把「发消息」到「落盘」的延迟从 800ms 降到接近 0。
 *
 * 【为什么要串行】localforage.setItem 是异步的；同一会话快速连发多条时，
 * 若并发写入可能「后发先至」导致旧快照覆盖新数据。用 per-key promise 链保证按调用顺序落盘。
 */
const writeChains = new Map<string, Promise<void>>()

/**
 * 落盘规范化（一次性完成两件事）：
 *  1)【去 Proxy】Pinia 的 Map/数组是深层响应式的，从里面读出的每条消息都是 Vue reactive Proxy；
 *     IndexedDB 用结构化克隆，无法克隆 Proxy（会抛 DataCloneError）。若只展开 sending 消息、
 *     其余历史消息原样写入，则第一条（唯一 sending）能存，之后每批都因混入历史 Proxy 而
 *     整批写入失败 —— 表现为「只存第一条」。JSON round-trip 可彻底去 Proxy（聊天消息均为
 *     可 JSON 序列化的 socket 数据）。
 *  2)【剥离瞬时状态】发送中的消息在 emit 时已离开客户端，刷新丢回执不代表失败，故不把
 *     sending 写进 IndexedDB（否则刷新后误判为失败）。内存仍保留 sending 供「发送中…」显示。
 */
function toPlainForStore(list: any[]): any[] {
    try {
        return JSON.parse(JSON.stringify(list, (k, v) =>
            k === 'status' && v === 'sending' ? undefined : v))
    } catch {
        // 极端情况（循环引用等）降级：至少保证顶层去 Proxy
        return list.map(m => {
            if (m && m.status === 'sending') {
                const { status: _drop, ...rest } = m
                return rest
            }
            return m
        })
    }
}

/** 立即写入（按 key 串行），返回本次写入的 promise */
function writeNow(key: string, list: any[]): Promise<void> {
    // slice 取最近 N 条，再转成无 Proxy 的普通对象数组后落盘
    const trimmed = toPlainForStore(list.slice(-MESSAGE_CACHE_MAX))
    const prev = writeChains.get(key) || Promise.resolve()
    const next = prev
        .then(() => store.setItem(key, trimmed))
        .then(() => undefined, () => undefined) // 吞掉存储错误，不影响聊天
    writeChains.set(key, next)
    void next.then(() => {
        if (writeChains.get(key) === next) writeChains.delete(key)
    })
    return next
}

/** 等待某个 key 上尚未完成的写入，避免 remove/clear 与进行中的写竞态 */
async function flushKey(key: string) {
    const pending = writeChains.get(key)
    if (pending) await pending
}

/**
 * 读取/导入时剥离「发送中」状态：
 * 消息在 emit 那一刻就已发给服务端；刷新/退出会让回执丢失，但后端不重发回执，
 * 若标记 failed 会误报（消息其实已送达）并诱导用户重复发送。因此残留的 sending
 * 一律视为已发送成功（去掉状态）。真正的失败以 status='failed' 落盘，原样保留。
 */
function stripSending(list: any[]) {
    return list.map(item => {
        if (!item || typeof item !== 'object') return item
        if (item.status === 'sending') delete item.status
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
            if (key.startsWith(up)) user.push([key.slice(up.length), stripSending(value)])
            else if (key.startsWith(rp)) room.push([key.slice(rp.length), stripSending(value)])
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
        if (userId) writeNow(keyUser(userId, peerId), list)
    },

    saveRoom(userId: string, roomId: string, list: any[]) {
        if (userId) writeNow(keyRoom(userId, roomId), list)
    },

    saveAlerts(userId: string, list: any[]) {
        if (userId) writeNow(keyAlerts(userId), list)
    },

    async removeRoom(userId: string, roomId: string) {
        const key = keyRoom(userId, roomId)
        await flushKey(key)
        return store.removeItem(key).catch(() => { /* ignore */ })
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
            throw new Error(t('cache.invalidJson'))
        }
        if (!parsed || parsed.format !== 'discuss-chat-backup') {
            throw new Error(t('cache.notBackup'))
        }
        if (parsed.version !== 2) {
            throw new Error(t('cache.unsupportedVersion', { version: parsed.version }))
        }
        if (!parsed.owner || parsed.owner.id !== userId) {
            throw new Error(t('cache.wrongAccount'))
        }
        const d = parsed.data || {}
        const users = Array.isArray(d.users) ? d.users : []
        const rooms = Array.isArray(d.rooms) ? d.rooms : []
        const alerts = Array.isArray(d.alerts) ? d.alerts : []

        const user: [string, any[]][] = []
        const room: [string, any[]][] = []
        for (const it of users) {
            if (it && typeof it.peerId === 'string' && Array.isArray(it.messages)) {
                const msgs = stripSending(it.messages)
                writeNow(keyUser(userId, it.peerId), msgs)
                user.push([it.peerId, msgs])
            }
        }
        for (const it of rooms) {
            if (it && typeof it.roomId === 'string' && Array.isArray(it.messages)) {
                const msgs = stripSending(it.messages)
                writeNow(keyRoom(userId, it.roomId), msgs)
                room.push([it.roomId, msgs])
            }
        }
        if (alerts.length) {
            writeNow(keyAlerts(userId), alerts)
        }
        return { user, room, alerts }
    }
}
