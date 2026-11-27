import { ref, watch, readonly } from 'vue'

/**
 * Markdown 偏好设置（全局单例，模式仿 hooks/theme.ts）：
 * - mdInputEnabled：Markdown 编辑模式开关（默认关闭）。开启后输入区显示
 *   格式工具栏与预览，图片/文件上传改为插入 Markdown 片段到输入框；
 *   关闭时输入区保持纯净，上传成功即直接发送。
 * - mdTheme：消息正文 Markdown 渲染主题（掘金 / GitHub 等），独立于上面的
 *   开关，切换即时生效。主题 CSS 来自 juejin-markdown-themes（mdnice），
 *   已拷贝到 src/assets/md-themes/，运行时按当前主题动态注入 <style>。
 *
 * 主题适配说明见 design.scss 的 .md-themed 区块：内容样式完全由主题接管、
 * 不受项目设计风格影响；收发气泡配色统一，日间按主题原样渲染，夜间统一
 * 反色适配。
 *
 * 配置存储按用户隔离（key 带 userId），换账号自动切换到该账号自己的配置。
 */

import githubCss from '@/assets/md-themes/github.min.css?raw'
import { useUserStore } from '@/store/modules/user'

/**
 * 其余主题按需异步加载：import.meta.glob 把每个主题拆成独立 chunk，
 * 选中哪个才拉取哪个，避免把全部主题 CSS 塞进主包。
 */
const themeLoaders = import.meta.glob('../assets/md-themes/*.min.css', {
    query: '?raw',
    import: 'default',
}) as Record<string, () => Promise<string>>

const idFromKey = (key: string) => key.split('/').pop()!.replace(/\.min\.css$/, '')

/** label 为 i18n key（prefs.json 的 md.*），渲染处经 t() 转换 */
const THEME_LABELS: Record<string, string> = {
    'github': 'md.themeGithub',
    'juejin': 'md.themeJuejin',
    'cyanosis': 'md.themeCyanosis',
    'awesome-green': 'md.themeAwesomeGreen',
    'Chinese-red': 'md.themeChineseRed',
    'arknights': 'md.themeArknights',
    'channing-cyan': 'md.themeChanningCyan',
    'condensed-night-purple': 'md.themeCondensedNightPurple',
    'devui-blue': 'md.themeDevuiBlue',
    'geek-black': 'md.themeGeekBlack',
    'greenwillow': 'md.themeGreenwillow',
    'healer-readable': 'md.themeHealerReadable',
    'hydrogen': 'md.themeHydrogen',
    'jzman': 'md.themeJzman',
    'keepnice': 'md.themeKeepnice',
    'lilsnake': 'md.themeLilsnake',
    'minimalism': 'md.themeMinimalism',
    'mk-cute': 'md.themeMkCute',
    'nico': 'md.themeNico',
    'orange': 'md.themeOrange',
    'qklhk-chocolate': 'md.themeQklhkChocolate',
    'scrolls-light': 'md.themeScrollsLight',
    'serene-rose': 'md.themeSereneRose',
    'simplicity-green': 'md.themeSimplicityGreen',
    'smartblue': 'md.themeSmartblue',
    'v-green': 'md.themeVGreen',
    'vue-pro': 'md.themeVuePro',
    'vuepress': 'md.themeVuepress',
    'yu': 'md.themeYu',
    'z-blue': 'md.themeZBlue',
}

/** 下拉框里靠前的常用主题，其余按 id 字母序追加 */
const THEME_ORDER = ['github', 'juejin', 'cyanosis', 'awesome-green']

/** 渲染字号档位（倍率，基准 1 = 主题写死的原始 px 字号）；
 *  「标准」定在 0.875（整体比主题默认小一档），保持 0.125 步长四档，
 *  上限 1.125 防止标题/表格撑破气泡 */
export const DEFAULT_MD_FONT_SCALE = 0.875

export const MD_FONT_SCALES: ReadonlyArray<{ value: number; label: string }> = [
    { value: 0.75, label: 'md.fontSmall' },
    { value: 0.875, label: 'md.fontStandard' },
    { value: 1, label: 'md.fontLarge' },
    { value: 1.125, label: 'md.fontXl' },
]

const isValidFontScale = (v: unknown): v is number =>
    typeof v === 'number' && MD_FONT_SCALES.some((f) => f.value === v)

export type MdThemeId = string

/** 默认渲染主题（静态内置，首屏即有样式） */
export const DEFAULT_MD_THEME: MdThemeId = 'github'

const lazyIds = Object.keys(themeLoaders)
    .map(idFromKey)
    .filter((id) => id !== DEFAULT_MD_THEME)

export const MD_THEMES: ReadonlyArray<{ id: MdThemeId; label: string }> = [
    ...THEME_ORDER.filter((id) => id === DEFAULT_MD_THEME || lazyIds.includes(id)),
    ...lazyIds.filter((id) => !THEME_ORDER.includes(id)).sort(),
].map((id) => ({ id, label: THEME_LABELS[id] || id }))

const THEME_CSS_KEYS = new Map(Object.keys(themeLoaders).map((k) => [idFromKey(k), k]))

const STYLE_ID = 'md-theme-style'
// 旧版全局 key（v1：所有账号共用一份配置），仅用于一次性迁移
const LEGACY_INPUT = 'mdInputEnabled'
const LEGACY_THEME = 'mdTheme'

/** 配置按用户隔离：key 带 userId 后缀，A/B 账号互不影响 */
const prefKey = (base: string) => `${base}:${useUserStore().userInfo.id || 'guest'}`

/**
 * 给主题 CSS 加作用域，避免污染全局。
 * 关键：主题容器上的 `md-themed` 与 `markdown-body` 是同一个元素，所以不能用
 * `.md-themed .markdown-body`（后代选择器不匹配容器自身），必须改写成复合选择器：
 *   `.markdown-body`      → `.md-themed.markdown-body`（容器本身）
 *   `.markdown-body h1`   → `.md-themed.markdown-body h1`（容器内后代）
 * 主题 CSS 都是扁平结构且所有选择器都含 .markdown-body（已校验），
 * 只需处理 @media/@supports 递归与 @keyframes 原样保留。
 */
function scopeCss(css: string, scope: string): string {
    let result = ''
    let i = 0
    while (i < css.length) {
        const brace = css.indexOf('{', i)
        if (brace === -1) {
            result += css.slice(i)
            break
        }
        let prelude = css.slice(i, brace)
        // 前置的无块 at-rule（如 @charset / @import，以 ; 结尾）：原样输出，不参与选择器改写
        let leading = ''
        const semi = prelude.lastIndexOf(';')
        if (semi !== -1) {
            leading = prelude.slice(0, semi + 1)
            prelude = prelude.slice(semi + 1)
        }
        // 找到与该 '{' 匹配的 '}'
        let depth = 1
        let j = brace + 1
        while (j < css.length && depth > 0) {
            const ch = css[j]
            if (ch === '{') depth++
            else if (ch === '}') depth--
            j++
        }
        const body = css.slice(brace + 1, j - 1)
        const at = prelude.trim()
        if (at.startsWith('@media') || at.startsWith('@supports') || at.startsWith('@container')) {
            // 条件块：内部选择器继续加作用域
            result += leading + prelude + '{' + scopeCss(body, scope) + '}'
        } else if (at.startsWith('@')) {
            // @keyframes / @font-face 等：原样保留（内部不是选择器）
            result += leading + prelude + '{' + body + '}'
        } else {
            // 样式规则：逗号拆分后逐个改写；兜底：不含 .markdown-body 的选择器加后代前缀
            const scoped = prelude
                .split(',')
                .map((sel) => {
                    const t = sel.trim()
                    if (!t) return sel
                    if (t.includes('.markdown-body')) {
                        return t.replace(/\.markdown-body(?![\w-])/g, `${scope}.markdown-body`)
                    }
                    return `${scope} ${t}`
                })
                .join(',')
            result += leading + scoped + '{' + body + '}'
        }
        i = j
    }
    return result
}

function applyMdTheme(id: MdThemeId) {
    if (typeof document === 'undefined') return
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!style) {
        style = document.createElement('style')
        style.id = STYLE_ID
        document.head.appendChild(style)
    }
    const token = ++applyToken
    void loadThemeCss(id).then((css) => {
        // 加载期间用户又切了别的主题：丢弃过期结果
        if (token !== applyToken || css === null) return
        style!.textContent = `/* markdown 渲染主题：${id}（mdPreference.ts 注入） */\n`
            + scopeCss(scaleFontSizes(css), '.md-themed')
    })
}

/**
 * 渲染字号适配：主题 CSS 的字号全部是写死的 px（正文 15/16px、标题 12~32px），
 * 改容器 font-size 或根字号都影响不到。注入前统一改写成 px 基准 * 倍率变量：
 *   font-size: 16px → font-size: calc(16px * var(--md-font-scale,1))
 * 注意必须是「16px * 倍率」——calc 里数字 * 数字 = 纯数字，font-size 需要
 * length，写成 16 * var(...) 声明会被浏览器整体丢弃。
 * 倍率变量挂在 html 上（applyFontScale），设置页选档即时生效。
 * 只改 font-size 属性，margin/line-height 等 px 不动；em 字号相对正文自动跟随。
 * cssCache 缓存的是原始文本，改写发生在注入前，换主题/缓存命中都会重走这步。
 */
function scaleFontSizes(css: string): string {
    return css.replace(
        /font-size:\s*([0-9.]+)px/g,
        (_, n: string) => `font-size:calc(${n}px * var(--md-font-scale,1))`
    )
}

/** 字号倍率写入根元素 CSS 变量，所有 .md-themed 容器（气泡 + 预览）即时生效 */
function applyFontScale(scale: number) {
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty('--md-font-scale', String(scale))
}

/** 主题 CSS 按需加载（默认主题静态内置，其余走 glob 动态 chunk），带缓存 */
const cssCache = new Map<MdThemeId, string>()
let applyToken = 0

async function loadThemeCss(id: MdThemeId): Promise<string | null> {
    const cached = cssCache.get(id)
    if (cached !== undefined) return cached
    try {
        let css: string
        if (id === DEFAULT_MD_THEME) {
            css = githubCss
        } else {
            const key = THEME_CSS_KEYS.get(id)
            const loader = key ? themeLoaders[key] : undefined
            if (!loader) return null
            css = await loader()
        }
        cssCache.set(id, css)
        return css
    } catch {
        return null
    }
}

function isValidTheme(v: unknown): v is MdThemeId {
    return MD_THEMES.some((t) => t.id === v)
}

// 全局单例状态，多个组件共享
const mdInputEnabled = ref(false)
const mdThemeId = ref<MdThemeId>(DEFAULT_MD_THEME)
const mdFontScale = ref(DEFAULT_MD_FONT_SCALE)
let initialized = false

export function useMdPreference() {
    if (!initialized) {
        initialized = true
        const userStore = useUserStore()

        /** 读取当前用户的配置；首次读到空时从旧版全局 key 一次性迁移 */
        const loadUserPrefs = () => {
            const ik = prefKey('mdInputEnabled')
            const tk = prefKey('mdTheme')
            const fk = prefKey('mdFontSize')

            let input = localStorage.getItem(ik)
            if (input === null) {
                const legacy = localStorage.getItem(LEGACY_INPUT)
                if (legacy !== null) {
                    input = legacy
                    localStorage.setItem(ik, legacy)
                }
            }
            mdInputEnabled.value = input === '1'

            let theme = localStorage.getItem(tk)
            if (theme === null) {
                const legacy = localStorage.getItem(LEGACY_THEME)
                if (legacy && isValidTheme(legacy)) {
                    theme = legacy
                    localStorage.setItem(tk, legacy)
                }
            }
            // 没有保存过（或保存的是已下线的主题，如 fancy）就回落到默认主题，
            // 不能沿用上一个账号内存里的值
            mdThemeId.value = isValidTheme(theme) ? theme : DEFAULT_MD_THEME

            // 字号倍率：无有效保存值回落默认档「标准」（0.875），同样防跨账号泄漏
            const raw = Number(localStorage.getItem(fk))
            mdFontScale.value = isValidFontScale(raw) ? raw : DEFAULT_MD_FONT_SCALE
        }

        // 登录 / 登出 / 换账号时按用户重载配置（未登录时落在 guest 上）
        watch(() => userStore.userInfo.id, loadUserPrefs, { immediate: true })

        if (typeof window !== 'undefined') {
            // 多标签页同步（只响应当前用户的那对 key）
            window.addEventListener('storage', (e) => {
                if (e.key === prefKey('mdInputEnabled')) {
                    mdInputEnabled.value = e.newValue === '1'
                } else if (e.key === prefKey('mdTheme') && isValidTheme(e.newValue)) {
                    mdThemeId.value = e.newValue
                } else if (e.key === prefKey('mdFontSize')) {
                    const v = Number(e.newValue)
                    mdFontScale.value = isValidFontScale(v) ? v : DEFAULT_MD_FONT_SCALE
                }
            })
        }

        // 主题变化即时生效（首次也注入，气泡渲染始终走主题样式）并持久化到当前用户
        watch(mdThemeId, (id) => {
            applyMdTheme(id)
            if (typeof window !== 'undefined') {
                localStorage.setItem(prefKey('mdTheme'), id)
            }
        }, { immediate: true })

        // 字号变化即时生效（写根元素变量）并持久化到当前用户
        watch(mdFontScale, (v) => {
            applyFontScale(v)
            if (typeof window !== 'undefined') {
                localStorage.setItem(prefKey('mdFontSize'), String(v))
            }
        }, { immediate: true })

        // 开关变化持久化到当前用户
        watch(mdInputEnabled, (v) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem(prefKey('mdInputEnabled'), v ? '1' : '0')
            }
        })
    }

    return {
        /** Markdown 编辑模式开关（只读） */
        mdInputEnabled: readonly(mdInputEnabled),
        /** 当前渲染主题（只读） */
        mdTheme: readonly(mdThemeId),
        /** 当前渲染字号倍率（只读，1 = 主题默认大小） */
        mdFontScale: readonly(mdFontScale),
        setMdInputEnabled: (v: boolean) => { mdInputEnabled.value = v },
        setMdTheme: (id: MdThemeId) => { mdThemeId.value = id },
        setMdFontScale: (v: number) => { mdFontScale.value = v },
    }
}
