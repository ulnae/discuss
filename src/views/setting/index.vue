<template>
    <div class="settings">
        <header class="settings-head">
            <h1 class="settings-title">{{ t('setting.title') }}</h1>
            <p class="settings-sub">{{ t('setting.sub') }}</p>
        </header>

        <div class="settings-body">
            <!-- PC 侧边分组导航：移动端隐藏，四组面板全部展开 -->
            <nav class="settings-nav" :aria-label="t('setting.groupNav')">
                <button v-for="tab in SETTING_TABS" :key="tab.id" type="button" class="settings-nav-item"
                    :class="{ 'is-active': activeTab === tab.id }"
                    :aria-current="activeTab === tab.id ? 'true' : undefined" @click="activeTab = tab.id">
                    <span class="nav-bar"></span>{{ t(tab.label) }}
                </button>
            </nav>

            <div class="settings-panels">
                <!-- 账号信息：查看 / 编辑两种模式切换 -->
                <section class="settings-card settings-panel" :class="{ 'is-active': activeTab === 'account' }">
            <header class="card-head card-head-action">
                <span>{{ t('setting.accountTitle') }}</span>
                <!-- 查看模式：编辑按钮；编辑模式：取消 / 保存，二者都放在标题行右侧 -->
                <button v-if="!accountEditing" type="button" class="edit-toggle" @click="startEdit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    {{ t('common.edit') }}
                </button>
                <div v-else class="head-actions">
                    <button type="button" class="btn btn-ghost btn-sm" :disabled="accountSaving" @click="cancelEdit">
                        {{ t('common.cancel') }}
                    </button>
                    <button type="submit" form="account-form" class="btn btn-primary btn-sm" :disabled="accountSaving">
                        {{ accountSaving ? t('common.saving') : t('common.save') }}
                    </button>
                </div>
            </header>

            <!-- 查看模式 -->
            <div v-if="!accountEditing" class="kv">
                <div v-for="row in accountRows" :key="row.k" class="kv-row">
                    <span class="kv-k">{{ row.k }}</span>
                    <span class="kv-v">{{ row.v }}</span>
                </div>
            </div>

            <!-- 编辑模式：用户名 / 邮箱 / 密码一次提交，改密码或邮箱需填原密码 -->
            <form v-else id="account-form" class="card-form" @submit.prevent="handleSaveAccount">
                <label class="form-field">
                    <span class="form-label">{{ t('setting.username') }}</span>
                    <input v-model.trim="accountForm.username" type="text" autocomplete="username"
                        :placeholder="t('setting.usernamePh')" maxlength="100" />
                </label>
                <label class="form-field">
                    <span class="form-label">{{ t('setting.email') }}</span>
                    <input v-model.trim="accountForm.email" type="email" autocomplete="email"
                        :placeholder="t('setting.emailPh')" maxlength="100" />
                </label>
                <label class="form-field">
                    <span class="form-label">{{ t('setting.newPassword') }} <em>{{ t('setting.newPasswordHint') }}</em></span>
                    <input v-model="accountForm.password" type="password" autocomplete="new-password"
                        :placeholder="t('setting.newPasswordPh')" maxlength="32" />
                </label>
                <label class="form-field">
                    <span class="form-label">{{ t('setting.confirmPassword') }}</span>
                    <input v-model="accountForm.confirmPassword" type="password" autocomplete="new-password"
                        :placeholder="t('setting.confirmPasswordPh')" maxlength="32" />
                </label>
                <label class="form-field">
                    <span class="form-label">{{ t('setting.currentPassword') }} <em>{{ t('setting.currentPasswordHint') }}</em></span>
                    <input v-model="accountForm.oldPassword" type="password" autocomplete="current-password"
                        :placeholder="t('setting.currentPasswordPh')" />
                </label>
            </form>
        </section>

                <section class="settings-card settings-panel" :class="{ 'is-active': activeTab === 'records' }">
            <header class="card-head">{{ t('setting.recordsTitle') }}</header>
            <p class="card-desc">{{ t('setting.recordsDesc') }}</p>
            <div class="card-actions">
                <button type="button" class="btn btn-ghost" @click="handleExport">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                    {{ t('setting.export') }}
                </button>
                <button type="button" class="btn btn-ghost" @click="handleImport">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M12 15V3m0 0 4 4m-4-4-4 4" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                    {{ t('setting.import') }}
                </button>
            </div>
        </section>

                <section class="settings-card settings-panel" :class="{ 'is-active': activeTab === 'markdown' }">
            <header class="card-head">{{ t('setting.mdTitle') }}</header>
            <!-- Markdown 编辑模式开关：只影响输入区 UI 与上传行为，不影响消息渲染 -->
            <div class="md-setting-row">
                <div class="md-setting-info">
                    <span class="md-setting-label">{{ t('setting.mdEditLabel') }}</span>
                    <span class="md-setting-desc">{{ t('setting.mdEditDesc') }}</span>
                </div>
                <button type="button" class="md-switch" :class="{ on: mdInputEnabled }" role="switch"
                    :aria-checked="mdInputEnabled" :title="mdInputEnabled ? t('setting.mdEditOn') : t('setting.mdEditOff')"
                    @click="setMdInputEnabled(!mdInputEnabled)">
                    <span class="md-switch-thumb"></span>
                </button>
            </div>
            <!-- 渲染主题：独立于上面的开关，只管消息正文的视觉样式 -->
            <div class="md-setting-row">
                <div class="md-setting-info">
                    <span class="md-setting-label">{{ t('setting.mdThemeLabel') }}</span>
                    <span class="md-setting-desc">{{ t('setting.mdThemeDesc') }}</span>
                </div>
                <div class="md-theme-select-wrap">
                    <select class="md-theme-select" :value="mdTheme" @change="onThemeChange">
                        <option v-for="m in MD_THEMES" :key="m.id" :value="m.id">{{ t(m.label) }}</option>
                    </select>
                </div>
            </div>
            <!-- 渲染字号：等比缩放主题全部字号（正文/标题/代码块） -->
            <div class="md-setting-row">
                <div class="md-setting-info">
                    <span class="md-setting-label">{{ t('setting.mdFontLabel') }}</span>
                    <span class="md-setting-desc">{{ t('setting.mdFontDesc') }}</span>
                </div>
                <div class="md-theme-select-wrap">
                    <select class="md-theme-select" :value="mdFontScale" @change="onFontScaleChange">
                        <option v-for="f in MD_FONT_SCALES" :key="f.value" :value="f.value">{{ t(f.label) }}</option>
                    </select>
                </div>
            </div>
        </section>

                <!-- 界面外观：自定义配色方案（颜色，日夜各一套） -->
                <section class="settings-card settings-panel" :class="{ 'is-active': activeTab === 'appearance' }">
            <header class="card-head">{{ t('setting.appearanceTitle') }}</header>
            <p class="card-desc">{{ t('setting.appearanceDesc') }}</p>

            <!-- 编辑模式切换：日间 / 夜间 -->
            <div class="scheme-mode-bar">
                <button type="button" class="scheme-mode-btn" :class="{ on: schemeEditMode === 'light' }"
                    @click="schemeEditMode = 'light'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                    {{ t('setting.day') }}
                </button>
                <button type="button" class="scheme-mode-btn" :class="{ on: schemeEditMode === 'dark' }"
                    @click="schemeEditMode = 'dark'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
                    {{ t('setting.night') }}
                </button>
                <span class="scheme-mode-hint">{{ t('setting.editingHint', { mode: schemeEditMode === 'light' ? t('setting.day') : t('setting.night') }) }}</span>
            </div>

            <!-- 按分组列出颜色 token -->
            <div v-for="group in [...new Set(schemeTokens.map((item) => item.group))]" :key="group" class="scheme-group">
                <div class="scheme-group-title">{{ t(group) }}</div>
                <div v-for="item in schemeTokens.filter((x) => x.group === group)" :key="item.key" class="scheme-color-row">
                    <span class="scheme-color-label">{{ t(item.label) }}</span>
                    <span class="scheme-color-var">{{ item.key }}</span>
                    <button type="button" class="scheme-color-reset"
                        :class="{ 'is-placeholder': !colorModified(item.key) }"
                        :aria-hidden="!colorModified(item.key)" :tabindex="colorModified(item.key) ? 0 : -1"
                        :title="t('setting.resetColor')" @click="onResetOneColor(item.key)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                            stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                    </button>
                    <span class="scheme-color-swatch" :style="{ background: schemeValue(schemeEditMode, item.key) }"></span>
                    <input type="color" class="scheme-color-input" :value="colorPickerValue(item.key)"
                        :aria-label="t('setting.setColorAria', { label: t(item.label) })" @input="onSchemeColorInput(item.key, $event)" />
                </div>
            </div>

            <!-- 方案操作：导出 / 导入 / 恢复默认 -->
            <div class="card-actions scheme-actions">
                <button type="button" class="btn btn-ghost btn-sm" @click="handleSchemeExport">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                    {{ t('setting.exportScheme') }}
                </button>
                <button type="button" class="btn btn-ghost btn-sm" @click="handleSchemeImport">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round"><path d="M12 15V3m0 0 4 4m-4-4-4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                    {{ t('setting.importScheme') }}
                </button>
                <button v-if="schemeCustomized" type="button" class="btn btn-ghost btn-sm danger-text"
                    @click="handleSchemeReset">{{ t('setting.resetScheme') }}</button>
            </div>
        </section>

                <section class="settings-card settings-panel settings-account"
                :class="{ 'is-active': activeTab === 'general' }">
            <header class="card-head">{{ t('setting.generalTitle') }}</header>
            <!-- 深色模式：左描述右开关，与 Markdown 编辑模式开关同一套视觉 -->
            <div class="md-setting-row">
                <div class="md-setting-info">
                    <span class="md-setting-label">{{ t('setting.darkLabel') }}</span>
                    <span class="md-setting-desc">{{ t('setting.darkDesc') }}</span>
                </div>
                <button type="button" class="md-switch" :class="{ on: isDark }" role="switch"
                    :aria-checked="isDark" :title="isDark ? t('setting.darkOn') : t('setting.darkOff')"
                    @click="toggleTheme">
                    <span class="md-switch-thumb"></span>
                </button>
            </div>
            <!-- 语言：左描述右分段切换，与深色模式行同一套视觉 -->
            <div class="md-setting-row">
                <div class="md-setting-info">
                    <span class="md-setting-label">{{ t('setting.langLabel') }}</span>
                    <span class="md-setting-desc">{{ t('setting.langDesc') }}</span>
                </div>
                <LanguageSwitch />
            </div>
            <!-- 退出登录：自定义危险操作区，图标 + 文案 + 描边按钮 -->
            <div class="logout-row">
                <div class="logout-main">
                    <span class="logout-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
                            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                    </span>
                    <div class="logout-info">
                        <span class="logout-title">{{ t('setting.logoutTitle') }}</span>
                        <span class="logout-desc">{{ t('setting.logoutDesc') }}</span>
                    </div>
                </div>
                <button type="button" class="btn btn-danger btn-sm logout-btn" @click="handleLogout">{{ t('setting.logoutBtn') }}</button>
            </div>
        </section>
            </div>
        </div>

        <input class="hidden" id="chooseHistoryFile" type="file" accept="*.json">
        <input class="hidden" id="chooseSchemeFile" type="file" accept="*.json">
    </div>
</template>

<script lang="ts" setup>
import { useUserStore } from '@/store/modules/user'
import { useSocketStore } from '@/store/modules/socket'
import { useAlertStore } from '@/store/modules/alert'
import userApi from '@/api/user'
import { MessageCache } from '@/utils/messageCache'
import { downloadJSON } from '@/utils/index'
import { toast } from '@/components/ui/toast'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/hooks/useTheme'
import { useMdPreference, MD_THEMES, MD_FONT_SCALES } from '@/hooks/useMdPreference'
import { useUiScheme, cssColorToHex, type ThemeMode } from '@/hooks/useUiScheme'
import { useFilePicker } from '@/hooks/useFilePicker'
import { mergeAlerts, mergeChatMessages } from '@/utils/messageMerge'
import LanguageSwitch from '@/components/ui/LanguageSwitch.vue'
const userStore = useUserStore()
const socketStore = useSocketStore()
const { t } = useI18n()

/** 侧边分组导航：label 是 i18n key，渲染时经 t() 转换 */
const SETTING_TABS = [
    { id: 'account', label: 'setting.tabAccount' },
    { id: 'records', label: 'setting.tabRecords' },
    { id: 'markdown', label: 'setting.tabMarkdown' },
    { id: 'appearance', label: 'setting.tabAppearance' },
    { id: 'general', label: 'setting.tabGeneral' },
] as const
/** 默认展示账号信息 */
const activeTab = ref<string>(SETTING_TABS[0].id)

// 主题切换与退出登录统一收敛在设置页（导航栏仅保留设置入口）
const { isDark, toggleTheme } = useTheme()
const handleLogout = () => userStore.logout()

// 消息 Markdown 偏好：编辑模式开关 + 渲染主题 + 渲染字号
const { mdInputEnabled, mdTheme, mdFontScale, setMdInputEnabled, setMdTheme, setMdFontScale } = useMdPreference()

/** 模板里不写 TS 断言（模板表达式按 JS 解析），select 的取值转换收敛到这里 */
const onThemeChange = (e: Event) => setMdTheme((e.target as HTMLSelectElement).value)
const onFontScaleChange = (e: Event) => setMdFontScale(Number((e.target as HTMLSelectElement).value))

/* ---------- 界面外观：自定义配色方案（日间 / 夜间各一套） ---------- */
const {
  tokens: schemeTokens,
  isCustomized: schemeCustomized,
  effectiveValue: schemeValue,
  isModified: schemeIsModified,
  setColor: setSchemeColor,
  resetColor: resetSchemeColor,
  resetAll: resetSchemeAll,
  exportScheme,
  importScheme,
} = useUiScheme()

/** 当前正在编辑的外观模式（日间 / 夜间），与全局深色模式开关独立 */
const schemeEditMode = ref<ThemeMode>('light')

/** 供 <input type="color"> 绑定：把任意 CSS 颜色转成可编辑的 #rrggbb */
const colorPickerValue = (key: string) => cssColorToHex(schemeValue(schemeEditMode.value, key))

/** 某一项在当前编辑模式下是否被改动 */
const colorModified = (key: string) => schemeIsModified(schemeEditMode.value, key)

/** 色块改动即时生效 */
const onSchemeColorInput = (key: string, e: Event) => {
  setSchemeColor(schemeEditMode.value, key, (e.target as HTMLInputElement).value)
}

/** 重置单个颜色（恢复 design.scss 默认值） */
const onResetOneColor = (key: string) => resetSchemeColor(schemeEditMode.value, key)

/** 导出配色方案 JSON */
const handleSchemeExport = () => {
  const data = exportScheme()
  const date = new Date().toISOString().slice(0, 10)
  downloadJSON(data, `discuss-ui-scheme-${date}.json`)
  toast.success(t('setting.schemeExported'))
}

/** 导入配色方案：走隐藏 file input */
const handleSchemeImport = () => document.getElementById('chooseSchemeFile')?.click()

useFilePicker('chooseSchemeFile', async (file) => {
  try {
    const parsed = JSON.parse(await file.text())
    if (!importScheme(parsed)) {
      toast.error(t('setting.schemeBadFile'))
      return
    }
    toast.success(t('setting.schemeImported'))
  } catch {
    toast.error(t('setting.schemeParseFail'))
  }
})

/** 一键恢复默认配色（带确认由按钮自身二次点击简化，这里直接恢复 + 提示） */
const handleSchemeReset = () => {
  resetSchemeAll()
  toast.success(t('setting.schemeResetOk'))
}

/** 账号信息展示：隐藏令牌类字段，常见字段换成已翻译标签 */
const LABELS: Record<string, string> = {
    id: 'setting.labelId',
    username: 'setting.username',
    email: 'setting.email',
    createdAt: 'setting.labelCreated',
    updatedAt: 'setting.labelUpdated',
    expires_in: 'setting.labelExpires'
}
const HIDDEN = ['access_token', 'token_type']
const accountRows = computed(() =>
    Object.entries(userStore.userInfo)
        .filter(([k, v]) => !HIDDEN.includes(k) && v !== null && v !== undefined && v !== '')
        .map(([k, v]) => ({ k: t(LABELS[k] || k), v: String(v) }))
)

const currentUid = () => userStore.userInfo.id as string

/* ---------- 账号信息：查看 / 编辑策略模式 ---------- */
const accountEditing = ref(false)
const accountSaving = ref(false)
const accountForm = reactive({ username: '', email: '', password: '', confirmPassword: '', oldPassword: '' })

/** 进入编辑：用当前资料填充表单，密码字段留空 */
const startEdit = () => {
    accountForm.username = userStore.userInfo.username || ''
    accountForm.email = userStore.userInfo.email || ''
    accountForm.password = ''
    accountForm.confirmPassword = ''
    accountForm.oldPassword = ''
    accountEditing.value = true
}

const cancelEdit = () => {
    accountEditing.value = false
}

/** 保存：一次提交 username / email / password，改密码或邮箱需带 oldPassword */
const handleSaveAccount = async () => {
    if (accountSaving.value) return

    if (!accountForm.username) {
        toast.warning(t('setting.warnUsernameEmpty'))
        return
    }
    if (!accountForm.email) {
        toast.warning(t('setting.warnEmailEmpty'))
        return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountForm.email)) {
        toast.warning(t('setting.warnEmailBad'))
        return
    }

    const password = accountForm.password
    const emailChanged = accountForm.email !== userStore.userInfo.email
    const passwordChanged = !!password

    if (passwordChanged) {
        if (password.length < 6 || password.length > 32) {
            toast.warning(t('setting.warnPasswordLen'))
            return
        }
        if (password !== accountForm.confirmPassword) {
            toast.warning(t('setting.warnPasswordMismatch'))
            return
        }
        if (password === accountForm.oldPassword) {
            toast.warning(t('setting.warnPasswordSame'))
            return
        }
    }
    /* 改邮箱或密码都要原密码确认 */
    if ((emailChanged || passwordChanged) && !accountForm.oldPassword) {
        toast.warning(t('setting.warnNeedOldPassword'))
        return
    }

    accountSaving.value = true
    try {
        const payload: any = {
            username: accountForm.username,
            email: accountForm.email
        }
        if (emailChanged || passwordChanged) payload.oldPassword = accountForm.oldPassword
        if (passwordChanged) payload.password = password

        await userApi.UpdateUser(currentUid(), payload)

        if (passwordChanged) {
            // 改了密码：前端登出让旧 token 失效（决策：不做服务端 tokenVersion）
            toast.success(t('setting.savedNeedRelogin'))
            accountEditing.value = false
            userStore.logout()
        } else {
            // 只改用户名/邮箱：同步本地资料并退回查看模式
            userStore.syncProfile({
                username: accountForm.username,
                email: accountForm.email
            })
            toast.success(t('setting.saved'))
            accountEditing.value = false
        }
    } catch {
        /* 错误提示由 axios 拦截器统一弹出，这里不重复 */
    } finally {
        accountSaving.value = false
    }
}

const handleExport = async () => {
    try {
        // 导出当前账号的备份：v2 自描述结构，带版本与账号归属
        const backup = await MessageCache.exportBackup(currentUid(), userStore.userInfo.username)
        const date = new Date().toISOString().slice(0, 10)
        downloadJSON(backup, `discuss-chat-${currentUid()}-${date}.json`)
        toast.success(t('setting.chatExported'))
    } catch (error) {
        console.error('export failed:', error)
        toast.error(t('setting.chatExportFail'))
    }
}

const handleImport = () => {
    document.getElementById('chooseHistoryFile')?.click()
}


useFilePicker('chooseHistoryFile', async (file) => {
    try {
        const text = await file.text()
        // 解析 + 校验格式 / 版本 / 账号归属（他人备份会被拒绝），并落盘到当前账号
        const { user, room, alerts } = await MessageCache.importBackup(currentUid(), text)

        // 群聊 / 私聊记录：统一按 clientId/id 去重并合并进内存 Map
        room.forEach(([key, value]) => {
            const roomMessage = socketStore.roomMessageMap.get(key) || []
            socketStore.roomMessageMap.set(key, mergeChatMessages(roomMessage, value))
        })
        user.forEach(([key, value]) => {
            const userMessage = socketStore.userMessageMap.get(key) || []
            socketStore.userMessageMap.set(key, mergeChatMessages(userMessage, value))
        })
        // 系统广播：合并去重后按时间降序（最新在上），replaceAlerts 内部会落盘
        if (alerts.length) {
            const alertStore = useAlertStore()
            alertStore.replaceAlerts(mergeAlerts(alertStore.alerts, alerts))
        }
        toast.success(t('setting.chatImported'))
    } catch (error: any) {
        console.error('parse failed:', error)
        toast.error(error?.message || t('setting.importFail'))
    }
})

</script>

<style lang="scss" scoped>
/* PC：左侧固定宽度分组导航 + 右侧单一内容面板。一次只显示一组，
   消除宽屏留白与卡片高度参差；高度保留 height:100% + overflow-y:auto 兜底。 */
.settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    box-sizing: border-box;
    height: 100%;
    padding: 1.6rem 1.75rem 2rem;
    overflow-y: auto;

    >* {
        min-width: 0;
        flex-shrink: 0;
    }

    /* 隐藏的文件输入脱离视觉流，避免占位 */
    > input.hidden {
        display: none;
    }
}

.settings-body {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    flex: 1;
    min-height: 0;
}

/* 侧边导航容器 */
.settings-nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 170px;
    flex-shrink: 0;
    padding: 6px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
}

.settings-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.6rem 0.75rem;
    font-size: 0.8rem;
    text-align: left;
    color: var(--text-2);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
    box-sizing: border-box;
    transition: color 0.16s ease, background-color 0.16s ease;

    &:hover {
        color: var(--text);
        background: var(--surface-3);
    }

    /* 左侧强调竖条，默认透明，选中时显现 */
    .nav-bar {
        position: absolute;
        left: 0;
        top: 50%;
        width: 2px;
        height: 1.1rem;
        border-radius: 2px;
        background: var(--accent);
        transform: translateY(-50%) scaleY(0);
        transition: transform 0.16s ease;
    }

    &.is-active {
        color: var(--accent);
        font-weight: 500;
        background: var(--surface-3);

        .nav-bar {
            transform: translateY(-50%) scaleY(1);
        }
    }
}

/* 右侧面板区：PC 下一次只显示当前分组 */
.settings-panels {
    flex: 1;
    min-width: 0;
}

.settings-panel {
    display: none;

    &.is-active {
        display: block;
    }
}

/* 窄屏 / 移动端：隐藏侧栏，四组面板全部展开，回退到单列流布局 */
@media (max-width: 860px) {
    .settings {
        width: min(720px, 100%);
        margin: 0 auto;
        padding: 1.6rem 1.25rem 2rem;
    }

    .settings-body {
        display: block;
        flex: none;
    }

    .settings-nav {
        display: none;
    }

    /* 媒体查询里显式覆盖 class 切换，让四组全部展开 */
    .settings-panel,
    .settings-panel.is-active {
        display: block;
    }

    .settings-panels .settings-panel {
        margin-bottom: 12px;
    }

    .settings-panels .settings-panel:last-child {
        margin-bottom: 0;
    }
}

@media (max-width: 768px) {
    .settings {
        padding: 1rem 0.85rem calc(1.2rem + env(safe-area-inset-bottom));
    }
}

/* ---------- 外观与账号：退出登录操作区 ---------- */
.logout-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1rem;
    border-top: 1px solid var(--border);
}

.logout-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
}

.logout-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.2rem;
    height: 2.2rem;
    flex-shrink: 0;
    color: var(--danger);
    background: var(--danger-soft);
    border-radius: var(--radius-md);

    svg {
        width: 16px;
        height: 16px;
    }
}

.logout-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
}

.logout-title {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text);
}

.logout-desc {
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--text-3);
}

/* 复用全局 .btn.btn-danger.btn-sm（与确认弹窗同一套危险按钮），这里只保留 flex 布局约束 */
.logout-btn {
    flex-shrink: 0;
}

/* 窄屏：信息区与按钮上下排列，按钮撑满更易点击 */
@media (max-width: 480px) {
    .logout-row {
        flex-direction: column;
        align-items: stretch;
        gap: 0.85rem;
    }

    .logout-btn {
        width: 100%;
    }
}

.settings-head {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0 0.2rem 0.2rem;
}

.settings-title {
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--text);
}

.settings-sub {
    font-size: 0.75rem;
    color: var(--text-2);
}

.settings-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-solid);
    box-shadow: var(--shadow-soft);
    overflow: hidden;
}

.card-head {
    padding: 0.75rem 1rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text);
    border-bottom: 1px solid var(--border);

    &.card-head-action {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        /* 查看态是编辑按钮、编辑态是取消+保存按钮，两者高度不同。
           锁死标题行高度 + 垂直居中，切换模式时这一行不再跳动。 */
        box-sizing: border-box;
        height: 3.4rem;
        padding-top: 0;
        padding-bottom: 0;
    }
}

/* 编辑态标题行右侧的取消 / 保存按钮组 */
.head-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
}

/* 账号信息卡片的「编辑」切换按钮 */
.edit-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 400;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.18s ease, border-color 0.18s ease;

    svg {
        width: 13px;
        height: 13px;
    }

    &:hover {
        background: var(--surface-2);
        border-color: var(--accent);
    }
}

.card-desc {
    padding: 0.75rem 1rem 0;
    font-size: 0.74rem;
    line-height: 1.6;
    color: var(--text-2);
}

/* ---------- 消息 Markdown 设置（左描述右配置） ---------- */
.md-setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;

    &+.md-setting-row {
        border-top: 1px solid var(--border);
    }
}

.md-setting-info {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
    flex: 1;
}

.md-setting-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text);
}

.md-setting-desc {
    font-size: 0.72rem;
    line-height: 1.6;
    color: var(--text-2);
}

/* 窄屏：描述与控件改为上下排列 */
@media (max-width: 480px) {
    .md-setting-row {
        flex-direction: column;
        align-items: stretch;
    }

    .md-theme-select-wrap {
        width: 100%;
    }
}

/* 开关 */
.md-switch {
    flex-shrink: 0;
    width: 2.4rem;
    height: 1.35rem;
    padding: 2px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.2s ease, border-color 0.2s ease;

    &.on {
        background: var(--accent);
        border-color: var(--accent);
    }
}

.md-switch-thumb {
    display: block;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: var(--surface-solid, #fff);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease;

    .md-switch.on & {
        transform: translateX(1.05rem);
    }
}

/* 渲染主题下拉框：appearance 去掉原生外观，自绘右侧箭头 */
.md-theme-select-wrap {
    position: relative;
    flex-shrink: 0;
    width: 200px;

    &::after {
        content: '';
        position: absolute;
        right: 0.85rem;
        top: 50%;
        width: 0.45rem;
        height: 0.45rem;
        border-right: 1.5px solid var(--text-3);
        border-bottom: 1.5px solid var(--text-3);
        transform: translateY(-70%) rotate(45deg);
        pointer-events: none;
    }
}

.md-theme-select {
    width: 100%;
    padding: 0.45rem 2.2rem 0.45rem 0.8rem;
    font-size: 0.78rem;
    font-family: inherit;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    transition: border-color 0.15s ease, background-color 0.15s ease;

    &:hover,
    &:focus {
        border-color: var(--border-strong);
        background: var(--surface-solid);
    }

    option {
        color: initial;
        background: initial;
    }
}

/* 账号信息编辑表单：沿用登录页字段视觉语言 */
.card-form {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.9rem 1rem 1rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.form-label {
    font-size: 0.74rem;
    color: var(--text-2);

    em {
        font-style: normal;
        color: var(--text-3);
        opacity: 0.75;
    }
}

.form-field input {
    width: 100%;
    height: 2.6rem;
    padding: 0 0.75rem;
    font-size: 0.85rem;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &::placeholder {
        color: var(--text-3);
    }

    &:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--surface-3);
    }
}

.card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.85rem 1rem 1rem;
}

.kv {
    display: flex;
    flex-direction: column;
}

.kv-row {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.55rem 1rem;
    font-size: 0.78rem;

    &+.kv-row {
        border-top: 1px solid var(--border);
    }
}

.kv-k {
    flex-shrink: 0;
    width: 88px;
    color: var(--text-3);
    font-size: 0.74rem;
}

.kv-v {
    flex: 1;
    min-width: 0;
    color: var(--text);
    word-break: break-all;
}

.auto-wrap {
    word-wrap: break-word;
    word-break: break-word;
    white-space: break-spaces;
}

/* ---------- 界面外观：自定义配色方案 ---------- */
.scheme-mode-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1rem 0.2rem;
}

.scheme-mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.7rem;
    font-size: 0.76rem;
    font-weight: 400;
    color: var(--text-2);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color 0.16s ease, background-color 0.16s ease, border-color 0.16s ease;

    svg {
        width: 14px;
        height: 14px;
    }

    &.on {
        color: var(--accent-fg);
        background: var(--accent);
        border-color: var(--accent);
    }
}

.scheme-mode-hint {
    margin-left: auto;
    font-size: 0.72rem;
    color: var(--text-3);
}

.scheme-group {
    padding: 0.6rem 1rem 0;
}

.scheme-group-title {
    padding-bottom: 0.4rem;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text-3);
}

.scheme-color-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.4rem 0;

    & + & {
        border-top: 1px solid var(--border);
    }
}

.scheme-color-label {
    flex: 0 0 88px;
    font-size: 0.76rem;
    color: var(--text);
}

.scheme-color-var {
    flex: 1;
    min-width: 0;
    font-family: JetBrainsMono, monospace;
    font-size: 0.66rem;
    color: var(--text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.scheme-color-swatch {
    flex-shrink: 0;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 4px;
    border: 1px solid var(--border-strong);
}

.scheme-color-input {
    flex-shrink: 0;
    width: 1.9rem;
    height: 1.9rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper { padding: 0; }
    &::-webkit-color-swatch { border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
}

.scheme-color-reset {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    color: var(--text-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color 0.16s ease, background-color 0.16s ease;

    svg { width: 14px; height: 14px; }

    &:hover {
        color: var(--danger);
        background: var(--danger-soft);
    }

    /* 未改动时保留占位、仅隐藏视觉，避免改动颜色后出现/消失导致整行抖动 */
    &.is-placeholder {
        visibility: hidden;
        pointer-events: none;
    }
}

.scheme-actions {
    margin-top: 0.6rem;
}

.danger-text {
    color: var(--danger) !important;
}

@media (max-width: 480px) {
    /* 与 PC 保持同一结构：左介绍、右颜色，仅隐藏编辑模式提示文字 */
    .scheme-mode-hint { display: none; }
}
</style>
