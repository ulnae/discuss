import { reactive } from 'vue'
import { i18n } from '@/locales'

const t = i18n.global.t

export interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  /** 危险操作（删除、解散、移出）用醒目按钮色 */
  danger?: boolean
}

export interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  danger: boolean
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  danger: false
})

let resolver: ((value: boolean) => void) | null = null

/** 关闭当前弹窗并兑现 Promise，供全局 host 与键盘事件共用 */
export function resolveConfirm(value: boolean) {
  if (!confirmState.open) return
  confirmState.open = false
  const resolve = resolver
  resolver = null
  resolve?.(value)
}

/**
 * 全局确认弹窗。替代散落在业务代码里的 window.confirm。
 *
 *   if (!(await showConfirm('确定删除吗？', { danger: true }))) return
 */
export function showConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  // 极端情况下连续触发两次：先把上一个按取消处理，避免 resolver 被覆盖后永远挂起
  resolveConfirm(false)

  confirmState.title = options.title ?? t('confirm.title')
  confirmState.message = message
  confirmState.confirmText = options.confirmText ?? t('common.confirm')
  confirmState.cancelText = options.cancelText ?? t('common.cancel')
  confirmState.danger = options.danger ?? false
  confirmState.open = true

  return new Promise<boolean>(resolve => {
    resolver = resolve
  })
}
