/**
 * Socket 适配层 —— 让前端在两种后端之间切换，业务代码（socket store / call store）不用改。
 *
 *  - VITE_APP_RUNTIME=nestjs → Socket.IO（server-nestjs 的 /websocket 网关）
 *  - VITE_APP_RUNTIME=worker → 原生 WebSocket（Cloudflare Durable Object，/api/ws）
 *
 * 对外 API 与 socket.io-client 用到的子集保持一致：on / off / emit / disconnect / connected，
 * 以及 'connect' / 'disconnect' 两个事件；帧格式为 { event, data }。
 */
import { io } from 'socket.io-client'

export type SocketHandler = (payload?: any) => void

export interface SocketLike {
    on(event: string, handler: SocketHandler): SocketLike
    off(event: string, handler?: SocketHandler): SocketLike
    emit(event: string, payload?: any): SocketLike
    disconnect(): void
    readonly connected: boolean
}

const HEARTBEAT = 25_000
const MAX_RETRY_DELAY = 15_000

class NativeSocket implements SocketLike {
    private ws: WebSocket | null = null
    private handlers = new Map<string, Set<SocketHandler>>()
    private queue: string[] = []
    private retry = 0
    private closed = false
    private retryTimer: ReturnType<typeof setTimeout> | null = null
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private readonly endpoint: string
    private readonly apiBase: string
    private readonly authToken: string

    constructor(baseURL: string, token: string) {
        const origin = String(baseURL || '').replace(/\/+$/, '')
        const wsOrigin = origin.replace(/^http/i, 'ws')
        this.endpoint = `${wsOrigin}/api/ws`
        // ticket 60s 过期，所以每次建立连接前都要重新换取
        this.apiBase = origin
        this.authToken = token
        this.open()
    }

    get connected() {
        return !!this.ws && this.ws.readyState === WebSocket.OPEN
    }

    on(event: string, handler: SocketHandler) {
        if (!this.handlers.has(event)) this.handlers.set(event, new Set())
        this.handlers.get(event)!.add(handler)
        return this
    }

    off(event: string, handler?: SocketHandler) {
        if (!handler) {
            this.handlers.delete(event)
        } else {
            this.handlers.get(event)?.delete(handler)
        }
        return this
    }

    emit(event: string, payload?: any) {
        const frame = JSON.stringify({ event, data: payload })
        if (this.connected) this.ws!.send(frame)
        else this.queue.push(frame)
        return this
    }

    disconnect() {
        this.closed = true
        this.stopHeartbeat()
        if (this.retryTimer) clearTimeout(this.retryTimer)
        this.retryTimer = null
        try { this.ws?.close() } catch { /* ignore */ }
        this.ws = null
        this.emitLocal('disconnect')
    }

    /* -------------------- 内部实现 -------------------- */

    /** 向 REST 换取 60 秒 WS 连接短票；换取失败时退回直接带 JWT（兼容旧服务端） */
    private async fetchTicket(): Promise<string> {
        try {
            const res = await fetch(`${this.apiBase}/api/ws/ticket`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            })
            const json: any = await res.json()
            if (json && json.code === 200 && json.data && json.data.ticket) {
                return json.data.ticket as string
            }
        } catch { /* ignore */ }
        return this.authToken
    }

    private async open() {
        if (this.closed) return
        const ticket = await this.fetchTicket()
        if (this.closed) return
        try {
            this.ws = new WebSocket(`${this.endpoint}?token=${encodeURIComponent(ticket)}`)
        } catch {
            this.scheduleReconnect()
            return
        }

        this.ws.onopen = () => {
            this.retry = 0
            this.emitLocal('connect')
            while (this.queue.length && this.connected) {
                this.ws!.send(this.queue.shift()!)
            }
            this.startHeartbeat()
        }

        this.ws.onmessage = (event: MessageEvent) => {
            if (typeof event.data !== 'string') return
            if (event.data === 'pong') return
            try {
                const packet = JSON.parse(event.data)
                if (packet && packet.event) this.emitLocal(packet.event, packet.data)
            } catch {
                /* 非 JSON 帧忽略 */
            }
        }

        this.ws.onclose = () => {
            this.stopHeartbeat()
            this.emitLocal('disconnect')
            if (!this.closed) this.scheduleReconnect()
        }

        this.ws.onerror = () => {
            /* 浏览器随后会触发 close，这里不重复处理 */
        }
    }

    private scheduleReconnect() {
        if (this.closed) return
        const delay = Math.min(1000 * 2 ** this.retry, MAX_RETRY_DELAY)
        this.retry += 1
        if (this.retryTimer) clearTimeout(this.retryTimer)
        this.retryTimer = setTimeout(() => this.open(), delay)
    }

    /** 心跳用裸文本 ping：DO 侧配置了自动 pong，不会唤醒休眠实例 */
    private startHeartbeat() {
        this.stopHeartbeat()
        this.heartbeatTimer = setInterval(() => {
            if (this.connected) {
                try { this.ws!.send('ping') } catch { /* ignore */ }
            }
        }, HEARTBEAT)
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
    }

    private emitLocal(event: string, payload?: any) {
        const set = this.handlers.get(event)
        if (!set) return
        set.forEach(handler => {
            try { handler(payload) } catch (error) { console.error(`[socket] ${event} handler error`, error) }
        })
    }
}

/** 按环境返回对应的 socket 实例（类型放宽，保持与 socket.io-client 的调用兼容） */
export async function connectSocket(token: string): Promise<any> {
    const runtime = import.meta.env.VITE_APP_RUNTIME
    const apiBase = import.meta.env.VITE_APP_API_BASE_URL as string
    // 实时通道独立配置（若无独立值则复用 API 域名；生产环境两者同源）
    const wsBase = (import.meta.env.VITE_APP_WS_BASE_URL as string) || apiBase

    if (runtime === 'worker') return new NativeSocket(wsBase, token)

    return io(apiBase, {
        path: '/websocket',
        transports: ['websocket'],
        auth: { token }
    })
}
