/**
 * i18n 入口：vue-i18n + 分片字典。
 *
 * 字典按模块拆分为多份 JSON（zh-CN/en 各一份同名分片），在这里合并，
 * 避免并行改造时多任务同时写一个大文件。
 *
 * key 命名规范（点分层级，与目录/职责对应）：
 *   common.*    跨页面通用词（确认/取消/保存/加载中…）
 *   nav.*       导航与页面标题
 *   login.*     登录/注册页
 *   setting.*   设置页
 *   friend.*    好友模块
 *   room.*      房间模块（含群聊）
 *   apply.*     好友/房间申请
 *   chat.*      消息气泡与输入区
 *   call.*      语音通话
 *   dash.*      仪表盘/通知
 *   http.*      HTTP 状态码兜底文案（前端本地）
 *   error.*     后端 HTTP 错误 key（服务端返回 i18nKey）
 *   ws.*        后端 WebSocket exception / 通知 key
 *   md.*        Markdown 设置（主题名/字号档位）
 *   ui.*        界面外观（颜色 token label）
 *   lang.*      语言名称（切换器自身）
 */
import { createI18n } from 'vue-i18n'

import commonZh from './zh-CN/common.json'
import loginZh from './zh-CN/login.json'
import settingZh from './zh-CN/setting.json'
import httpZh from './zh-CN/http.json'
import miscZh from './zh-CN/misc.json'
import serverZh from './zh-CN/server.json'
import friendZh from './zh-CN/friend.json'
import roomZh from './zh-CN/room.json'
import applyZh from './zh-CN/apply.json'
import chatZh from './zh-CN/chat.json'
import callZh from './zh-CN/call.json'
import prefsZh from './zh-CN/prefs.json'
import commonEn from './en/common.json'
import loginEn from './en/login.json'
import settingEn from './en/setting.json'
import httpEn from './en/http.json'
import miscEn from './en/misc.json'
import serverEn from './en/server.json'
import friendEn from './en/friend.json'
import roomEn from './en/room.json'
import applyEn from './en/apply.json'
import chatEn from './en/chat.json'
import callEn from './en/call.json'
import prefsEn from './en/prefs.json'

/**
 * 分片清单：每个 JSON 顶层自带模块名（如 friend.json = { "friend": {...} }），
 * 在此统一展开；新增模块时 zh 与 en 需同步成对出现。
 */
const zhCN = {
    ...commonZh, ...loginZh, ...settingZh, ...httpZh,
    ...miscZh, ...serverZh, ...friendZh, ...roomZh, ...applyZh, ...chatZh, ...callZh, ...prefsZh,
}
const en = {
    ...commonEn, ...loginEn, ...settingEn, ...httpEn,
    ...miscEn, ...serverEn, ...friendEn, ...roomEn, ...applyEn, ...chatEn, ...callEn, ...prefsEn,
}

export type AppLocale = 'zh-CN' | 'en'

export const LOCALES: ReadonlyArray<{ value: AppLocale; label: string }> = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en', label: 'English' },
]

/** 语言持久化用设备级 key：登录页（未登录）也要能切换 */
const LOCALE_KEY = 'app-locale'

export function readLocale(): AppLocale {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null
    return saved === 'en' ? 'en' : 'zh-CN'
}

export function writeLocale(locale: AppLocale) {
    try { localStorage.setItem(LOCALE_KEY, locale) } catch { /* 隐私模式等场景静默 */ }
}

export const i18n = createI18n({
    legacy: false,
    locale: readLocale(),
    fallbackLocale: 'zh-CN',
    messages: { 'zh-CN': zhCN, en },
})

// 启动时同步 html[lang]，与持久化的语言一致
if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.global.locale.value === 'en' ? 'en' : 'zh-CN'
}

/** 全局语言切换：i18n + html[lang] + dayjs 相对时间一并联动 */
export function switchLocale(locale: AppLocale) {
    i18n.global.locale.value = locale
    writeLocale(locale)
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
    import('@/plugin/dayjs').then(({ applyDayjsLocale }) => applyDayjsLocale(locale))
}
