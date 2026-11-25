import { ref, computed, watch, readonly } from 'vue'
import { useUserStore } from '@/store/modules/user'

/**
 * 自定义 UI 配色方案（全局单例，模式仿 useMdPreference / useTheme）：
 * - 只覆盖 design.scss 里的颜色类 CSS 变量，日间/夜间各一套。
 * - 运行时在 <head> 注入 <style>，:root / html.dark 两块分别覆盖，
 *   放在 design.scss 之后 → 同特异性、后出现者生效，无需改动任何组件。
 * - 白名单机制：只有 TOKENS 里登记的变量可被覆盖，导入时逐项校验，
 *   防止通过变量名/值注入任意 CSS。
 * - 配置按用户隔离（key 带 userId），换账号自动切换；多标签页同步。
 *
 * 注意：Markdown 渲染主题与字号由 useMdPreference 独立管理，本模块不介入。
 */

export type ThemeMode = 'light' | 'dark'
export type SchemeColors = Record<string, string>

export interface UiSchemeFile {
    version: number
    name: string
    colors: Record<ThemeMode, SchemeColors>
}

interface Token {
    key: string
    label: string
    group: string
}

/** 可覆盖的颜色变量白名单（含分组，供设置页渲染） */
export const SCHEME_TOKENS: ReadonlyArray<Token> = [
    { key: '--accent', label: '主色', group: '主色' },
    { key: '--accent-hover', label: '主色（悬停）', group: '主色' },
    { key: '--accent-fg', label: '主色文字', group: '主色' },
    { key: '--brand-bg', label: '品牌块底色', group: '主色' },
    { key: '--brand-fg', label: '品牌块文字', group: '主色' },
    { key: '--text', label: '正文文字', group: '文字' },
    { key: '--text-2', label: '次要文字', group: '文字' },
    { key: '--text-3', label: '辅助文字', group: '文字' },
    { key: '--surface-solid', label: '卡片底色', group: '表面' },
    { key: '--surface', label: '表面底色', group: '表面' },
    { key: '--surface-2', label: '浅层表面', group: '表面' },
    { key: '--surface-3', label: '悬浮表面', group: '表面' },
    { key: '--border', label: '边框', group: '表面' },
    { key: '--border-strong', label: '强调边框', group: '表面' },
    { key: '--bubble-in-bg', label: '气泡底色', group: '聊天' },
    { key: '--success', label: '成功色', group: '状态' },
    { key: '--success-fg', label: '成功色文字', group: '状态' },
    { key: '--success-soft', label: '成功色浅底', group: '状态' },
    { key: '--warning', label: '警告色', group: '状态' },
    { key: '--warning-fg', label: '警告色文字', group: '状态' },
    { key: '--warning-soft', label: '警告色浅底', group: '状态' },
    { key: '--danger', label: '危险色', group: '状态' },
    { key: '--danger-fg', label: '危险色文字', group: '状态' },
    { key: '--danger-soft', label: '危险色浅底', group: '状态' },
    { key: '--info', label: '信息色', group: '状态' },
    { key: '--online-ring', label: '在线光晕', group: '状态' },
] as const

const TOKEN_KEYS = SCHEME_TOKENS.map((t) => t.key)
const STYLE_ID = 'ui-scheme-style'
const SCHEME_VERSION = 1

/** 配置按用户隔离：key 带 userId 后缀 */
const schemeKey = () => `uiScheme:${useUserStore().userInfo.id || 'guest'}`

/** CSS 颜色值安全校验：只接受常见颜色函数/十六进制/关键字，杜绝 ; } 等注入 */
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|transparent|rgba?\([\d.\s,%/]+\)|hsla?\([\d.\s,%/]+\)|oklch\([\d.\s,%/]+\))$/

/**
 * design.scss 里 soft 底色由 color-mix(in srgb, var(--状态色) N%, transparent) 派生，
 * 自定义属性的 computed 值会保留该函数字符串，因此校验白名单也要放行这一严格形式。
 */
const SAFE_SOFT = /^color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-fA-F]{3,8}|rgba?\([\d.\s,%/]+\)|hsla?\([\d.\s,%/]+\)|oklch\([\d.\s,%/]+\))\s+[\d.]+%\s*,\s*transparent\s*\)$/

function isSafeColor(v: unknown): v is string {
    if (typeof v !== 'string') return false
    const value = v.trim()
    return SAFE_COLOR.test(value) || SAFE_SOFT.test(value)
}

function ensureStyle(): HTMLStyleElement {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!style) {
        style = document.createElement('style')
        style.id = STYLE_ID
        document.head.appendChild(style)
    }
    return style
}

/** 读取某个模式下的默认变量值：临时移除 dark 类 / 清空本模块样式，读 computed 后还原 */
function readModeDefaults(mode: ThemeMode): SchemeColors {
    const root = document.documentElement
    const style = ensureStyle()
    const prevCss = style.textContent
    const hadDark = root.classList.contains('dark')
    style.textContent = ''
    root.classList.toggle('dark', mode === 'dark')
    const out: SchemeColors = {}
    for (const key of TOKEN_KEYS) {
        out[key] = getComputedStyle(root).getPropertyValue(key).trim()
    }
    root.classList.toggle('dark', hadDark)
    style.textContent = prevCss
    return out
}

/**
 * 把任意 CSS 颜色转成 #rrggbb，供 <input type="color"> 回填。
 * 借助浏览器 computed 值解析；color-mix() 会返回 color(srgb 0.88 0.11 0.28 / 0.12)，
 * 通道是 0~1 的浮点，需要换算成 0~255，否则会误判成近黑色。失败回落黑。
 */
export function cssColorToHex(value: string): string {
    if (!value) return '#000000'
    const probe = document.createElement('span')
    probe.style.color = ''
    probe.style.color = value
    document.body.appendChild(probe)
    const computed = getComputedStyle(probe).color
    probe.remove()
    const srgb = computed.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
    const channels = srgb
        ? [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255]
        : (computed.match(/[\d.]+/g) || []).map(Number)
    if (channels.length < 3) return '#000000'
    return '#' + channels.slice(0, 3)
        .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
        .join('')
}

function buildCss(colors: Record<ThemeMode, SchemeColors>): string {
    const block = (sel: string, map: SchemeColors) => {
        const body = TOKEN_KEYS
            .filter((k) => isSafeColor(map[k]))
            .map((k) => `  ${k}: ${map[k].trim()};`)
            .join('\n')
        return body ? `${sel} {\n${body}\n}` : ''
    }
    return [block(':root', colors.light), block('html.dark', colors.dark)]
        .filter(Boolean)
        .join('\n\n')
}

function validateFile(raw: unknown): raw is UiSchemeFile {
    if (!raw || typeof raw !== 'object') return false
    const f = raw as Partial<UiSchemeFile>
    if (f.version !== SCHEME_VERSION) return false
    if (typeof f.name !== 'string' || f.name.length > 60) return false
    if (!f.colors || typeof f.colors !== 'object') return false
    for (const mode of ['light', 'dark'] as const) {
        const map = f.colors[mode]
        if (!map || typeof map !== 'object') return false
        for (const [k, v] of Object.entries(map)) {
            if (!TOKEN_KEYS.includes(k) || !isSafeColor(v)) return false
        }
    }
    return true
}

// 全局单例状态
const defaults: Record<ThemeMode, SchemeColors> = { light: {}, dark: {} }
let defaultsLoaded = false
const custom = ref<Record<ThemeMode, SchemeColors> | null>(null)
const schemeName = ref('自定义方案')
let initialized = false

function ensureDefaults() {
    if (defaultsLoaded || typeof document === 'undefined') return
    defaultsLoaded = true
    defaults.light = readModeDefaults('light')
    defaults.dark = readModeDefaults('dark')
}

function loadUserScheme() {
    ensureDefaults()
    try {
        const raw = localStorage.getItem(schemeKey())
        if (raw) {
            const parsed = JSON.parse(raw)
            if (validateFile(parsed)) {
                custom.value = parsed.colors
                schemeName.value = parsed.name
                return
            }
        }
    } catch { /* 坏数据回落默认 */ }
    custom.value = null
    schemeName.value = '自定义方案'
}

function applyScheme() {
    if (typeof document === 'undefined') return
    ensureStyle().textContent = custom.value
        ? `/* 自定义 UI 配色方案（useUiScheme 注入） */\n` + buildCss(custom.value)
        : ''
}

/** 导出文件内容：默认值 + 覆盖项合并成完整方案，自包含、可跨账号导入 */
function buildExport(): UiSchemeFile {
    const merge = (mode: ThemeMode): SchemeColors => ({
        ...defaults[mode],
        ...(custom.value?.[mode] || {}),
    })
    return {
        version: SCHEME_VERSION,
        name: schemeName.value,
        colors: { light: merge('light'), dark: merge('dark') },
    }
}

export function useUiScheme() {
    if (!initialized) {
        initialized = true
        const userStore = useUserStore()

        watch(() => userStore.userInfo.id, loadUserScheme, { immediate: true })

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key !== schemeKey()) return
                if (!e.newValue) { custom.value = null; return }
                try {
                    const parsed = JSON.parse(e.newValue)
                    if (validateFile(parsed)) {
                        custom.value = parsed.colors
                        schemeName.value = parsed.name
                    }
                } catch { /* 忽略坏数据 */ }
            })
        }

        watch(custom, (v) => {
            applyScheme()
            if (typeof window !== 'undefined') {
                if (v) {
                    localStorage.setItem(schemeKey(), JSON.stringify(buildExport()))
                } else {
                    localStorage.removeItem(schemeKey())
                }
            }
        }, { immediate: true })
    }

    /** 当前生效值：覆盖项优先，否则取 design.scss 默认值 */
    function effectiveValue(mode: ThemeMode, key: string): string {
        return custom.value?.[mode]?.[key] ?? defaults[mode]?.[key] ?? ''
    }

    /** 某一项是否被改动（当前覆盖值与 design.scss 默认值不同） */
    function isModified(mode: ThemeMode, key: string): boolean {
        const cur = custom.value?.[mode]?.[key]
        if (!cur) return false
        return cur.trim() !== (defaults[mode]?.[key] ?? '').trim()
    }

    function setColor(mode: ThemeMode, key: string, value: string) {
        if (!TOKEN_KEYS.includes(key) || !isSafeColor(value)) return
        ensureDefaults()
        if (!custom.value) custom.value = { light: {}, dark: {} }
        custom.value = {
            light: { ...custom.value.light },
            dark: { ...custom.value.dark },
        }
        custom.value[mode][key] = value.trim()
    }

    function resetColor(mode: ThemeMode, key: string) {
        if (!custom.value?.[mode]) return
        const next = { light: { ...custom.value.light }, dark: { ...custom.value.dark } }
        delete next[mode][key]
        custom.value = (Object.keys(next.light).length || Object.keys(next.dark).length) ? next : null
    }

    function resetAll() {
        custom.value = null
        schemeName.value = '自定义方案'
    }

    function exportScheme(): UiSchemeFile {
        return buildExport()
    }

    /** 导入并覆盖：整份替换当前方案 */
    function importScheme(file: UiSchemeFile): boolean {
        if (!validateFile(file)) return false
        custom.value = file.colors
        schemeName.value = file.name
        return true
    }

    return {
        tokens: SCHEME_TOKENS,
        isCustomized: computed(() => custom.value !== null),
        schemeName: readonly(schemeName),
        effectiveValue,
        isModified,
        setColor,
        resetColor,
        resetAll,
        exportScheme,
        importScheme,
    }
}
