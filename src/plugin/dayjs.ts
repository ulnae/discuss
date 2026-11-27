import relativeTime from 'dayjs/plugin/relativeTime' // ES 2015
import zhCN from 'dayjs/locale/zh-cn'  // ES 2015

import dayjs from 'dayjs'
dayjs.extend(relativeTime)
dayjs.locale(zhCN)

/** i18n 语言切换时同步 dayjs 的相对时间文案（fromNow 等） */
export function applyDayjsLocale(locale: 'zh-CN' | 'en') {
    if (locale === 'en') {
        import('dayjs/locale/en').then((m) => dayjs.locale(m.default))
    } else {
        dayjs.locale(zhCN)
    }
}

export default dayjs
