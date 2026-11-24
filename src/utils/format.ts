import dayjs from '@/plugin/dayjs'

/** 名字首字母：中文取第一个字，空值统一显示 ? */
export function avatarInitial(name?: string | null): string {
  return (name || '?').trim().charAt(0).toUpperCase()
}

type TimeInput = string | number | Date | null | undefined

/** 日期：YYYY/MM/DD，空值占位 — */
export function formatDate(value: TimeInput, pattern = 'YYYY/MM/DD'): string {
  return value ? dayjs(value).format(pattern) : '—'
}

/** 相对时间：几分钟前 / 昨天… */
export function formatRelative(value: TimeInput): string {
  return value ? dayjs(value).fromNow() : '—'
}

/** 短时间：MM/DD HH:mm，空值占位 — */
export function formatShortTime(value: TimeInput): string {
  return value ? dayjs(value).format('MM/DD HH:mm') : '—'
}

/** 完整时间：YYYY/MM/DD HH:mm:ss，空值返回空串（用于 title 属性） */
export function formatFullTime(value: TimeInput): string {
  return value ? dayjs(value).format('YYYY/MM/DD HH:mm:ss') : ''
}
