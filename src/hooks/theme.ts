import { ref, computed, watch, readonly } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME: Theme = 'light'

// 全局单例状态，多个组件共享
const theme = ref<Theme>(DEFAULT_THEME)
let initialized = false

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  // 让浏览器原生控件（滚动条、表单等）也适配
  root.style.colorScheme = t
}

function isValidTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark'
}

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  /** 在亮色/暗色之间切换 */
  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  if (!initialized) {
    initialized = true

    if (typeof window !== 'undefined') {
      // 1. 读取本地存储
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isValidTheme(saved)) {
        theme.value = saved
      }

      // 2. 多标签页同步
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && isValidTheme(e.newValue)) {
          theme.value = e.newValue
        }
      })
    }

    // 3. 应用初始主题
    applyTheme(theme.value)

    // 4. 主题变化时应用并持久化
    watch(theme, (newTheme) => {
      applyTheme(newTheme)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newTheme)
      }
    })
  }

  return {
    /** 当前主题（只读） */
    theme: readonly(theme),
    /** 是否为暗色模式 */
    isDark,
    /** 设置主题 */
    setTheme,
    /** 切换亮/暗 */
    toggleTheme,
  }
}