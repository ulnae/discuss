import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
    id: number
    type: ToastType
    message: string
    duration: number
}

/** 同时最多显示 5 条，超出时挤掉最早的一条 */
const MAX_VISIBLE = 5
/** 默认 3 秒后自动隐藏 */
const DEFAULT_DURATION = 3000

const timers = new Map<number, ReturnType<typeof setTimeout>>()
let seed = 0

export const toastState = reactive<{ items: ToastItem[] }>({ items: [] })

export function dismissToast(id: number) {
    const timer = timers.get(id)
    if (timer) {
        clearTimeout(timer)
        timers.delete(id)
    }
    const index = toastState.items.findIndex(item => item.id === id)
    if (index > -1) toastState.items.splice(index, 1)
}

function push(type: ToastType, message: unknown, duration = DEFAULT_DURATION) {
    const text = String(message ?? '').trim()
    if (!text) return -1

    const ttl = duration > 0 ? duration : DEFAULT_DURATION

    /* 同样内容重复触发时（连续两个请求报同一个错）只重置倒计时，不堆叠成一列 */
    const exist = toastState.items.find(item => item.type === type && item.message === text)
    if (exist) {
        const timer = timers.get(exist.id)
        if (timer) clearTimeout(timer)
        timers.set(exist.id, setTimeout(() => dismissToast(exist.id), ttl))
        return exist.id
    }

    while (toastState.items.length >= MAX_VISIBLE) {
        dismissToast(toastState.items[0].id)
    }

    const id = ++seed
    toastState.items.push({ id, type, message: text, duration: ttl })
    timers.set(id, setTimeout(() => dismissToast(id), ttl))
    return id
}

/**
 * 全局轻提示：右上角小窗，3 秒后自动消失。
 *
 *   toast.success('登录成功')
 *   toast.error(error.message)
 */
export const toast = {
    success: (message: unknown, duration?: number) => push('success', message, duration),
    error: (message: unknown, duration?: number) => push('error', message, duration),
    info: (message: unknown, duration?: number) => push('info', message, duration),
    warning: (message: unknown, duration?: number) => push('warning', message, duration),
    dismiss: dismissToast,
    clear: () => [...toastState.items].forEach(item => dismissToast(item.id))
}

export default toast
