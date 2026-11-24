<template>
    <div class="settings">
        <header class="settings-head">
            <h1 class="settings-title">设置</h1>
            <p class="settings-sub">账号信息与本地聊天记录</p>
        </header>

        <!-- 账号信息：查看 / 编辑两种模式切换 -->
        <section class="settings-card">
            <header class="card-head card-head-action">
                <span>账号信息</span>
                <!-- 查看模式：编辑按钮；编辑模式：取消 / 保存，二者都放在标题行右侧 -->
                <button v-if="!accountEditing" type="button" class="edit-toggle" @click="startEdit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    编辑
                </button>
                <div v-else class="head-actions">
                    <button type="button" class="btn btn-ghost btn-sm" :disabled="accountSaving" @click="cancelEdit">
                        取消
                    </button>
                    <button type="submit" form="account-form" class="btn btn-primary btn-sm" :disabled="accountSaving">
                        {{ accountSaving ? '保存中…' : '保存' }}
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
                    <span class="form-label">用户名</span>
                    <input v-model.trim="accountForm.username" type="text" autocomplete="username"
                        placeholder="请输入用户名" maxlength="100" />
                </label>
                <label class="form-field">
                    <span class="form-label">邮箱</span>
                    <input v-model.trim="accountForm.email" type="email" autocomplete="email"
                        placeholder="请输入邮箱" maxlength="100" />
                </label>
                <label class="form-field">
                    <span class="form-label">新密码 <em>（留空则不修改）</em></span>
                    <input v-model="accountForm.password" type="password" autocomplete="new-password"
                        placeholder="6-32 位，留空不改" maxlength="32" />
                </label>
                <label class="form-field">
                    <span class="form-label">确认新密码</span>
                    <input v-model="accountForm.confirmPassword" type="password" autocomplete="new-password"
                        placeholder="再次输入新密码" maxlength="32" />
                </label>
                <label class="form-field">
                    <span class="form-label">当前密码 <em>（改邮箱或密码时必填）</em></span>
                    <input v-model="accountForm.oldPassword" type="password" autocomplete="current-password"
                        placeholder="请输入当前密码以确认身份" />
                </label>
            </form>
        </section>

        <section class="settings-card">
            <header class="card-head">本地聊天记录</header>
            <p class="card-desc">聊天记录只保存在这台设备的浏览器里。清理缓存或更换设备前，建议先导出备份。</p>
            <div class="card-actions">
                <button type="button" class="btn btn-ghost" @click="handleExport">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                    导出
                </button>
                <button type="button" class="btn btn-ghost" @click="handleImport">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M12 15V3m0 0 4 4m-4-4-4 4" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                    </svg>
                    导入
                </button>
            </div>
        </section>

        <section class="settings-card settings-account">
            <header class="card-head">外观与账号</header>
            <div class="card-actions account-actions">
                <button type="button" class="btn btn-ghost account-btn" @click="toggleTheme">
                    <svg v-if="theme === 'light'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    </svg>
                    {{ theme === 'light' ? '切换到深色' : '切换到浅色' }}
                </button>
                <button type="button" class="btn btn-ghost account-btn danger-btn" @click="handleLogout">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>
                    退出登录
                </button>
            </div>
        </section>

        <input class="hidden" id="chooseHistoryFile" type="file" accept="*.json">
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
import { computed, onMounted, reactive, ref } from 'vue'
import { sortBy, uniqWith, isEqual } from 'lodash-es';
import { useTheme } from '@/hooks/theme'
const userStore = useUserStore()
const socketStore = useSocketStore()

// 主题切换与退出登录统一收敛在设置页（导航栏仅保留设置入口）
const { theme, toggleTheme } = useTheme()
const handleLogout = () => userStore.logout()

/** 账号信息展示：隐藏令牌类字段，常见字段换成中文标签 */
const LABELS: Record<string, string> = {
    id: '用户 ID',
    username: '用户名',
    email: '邮箱',
    createdAt: '创建时间',
    updatedAt: '更新时间'
}
const HIDDEN = ['access_token', 'token_type']
const accountRows = computed(() =>
    Object.entries(userStore.userInfo)
        .filter(([k, v]) => !HIDDEN.includes(k) && v !== null && v !== undefined && v !== '')
        .map(([k, v]) => ({ k: LABELS[k] || k, v: String(v) }))
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
        toast.warning('用户名不能为空')
        return
    }
    if (!accountForm.email) {
        toast.warning('邮箱不能为空')
        return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountForm.email)) {
        toast.warning('邮箱格式不正确')
        return
    }

    const password = accountForm.password
    const emailChanged = accountForm.email !== userStore.userInfo.email
    const passwordChanged = !!password

    if (passwordChanged) {
        if (password.length < 6 || password.length > 32) {
            toast.warning('新密码长度需为 6-32 位')
            return
        }
        if (password !== accountForm.confirmPassword) {
            toast.warning('两次输入的新密码不一致')
            return
        }
        if (password === accountForm.oldPassword) {
            toast.warning('新密码不能与原密码相同')
            return
        }
    }
    /* 改邮箱或密码都要原密码确认 */
    if ((emailChanged || passwordChanged) && !accountForm.oldPassword) {
        toast.warning('修改邮箱或密码时，请填写当前密码确认身份')
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
            toast.success('账号信息已更新，请重新登录')
            accountEditing.value = false
            userStore.logout()
        } else {
            // 只改用户名/邮箱：同步本地资料并退回查看模式
            userStore.userInfo = {
                ...userStore.userInfo,
                username: accountForm.username,
                email: accountForm.email
            }
            localStorage.setItem('userInfo', JSON.stringify(userStore.userInfo))
            toast.success('账号信息已更新')
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
        toast.success('聊天记录已导出')
    } catch (error) {
        console.error('导出失败:', error)
        toast.error('聊天记录导出失败')
    }
}

const handleImport = () => {
    document.getElementById('chooseHistoryFile')?.click()
}


onMounted(() => {
    document.getElementById('chooseHistoryFile')?.addEventListener('change', async (e) => {
        const input = e.target as HTMLInputElement
        const file = input.files?.[0]
        if (!file) return

        try {
            const text = await file.text()
            // 解析 + 校验格式 / 版本 / 账号归属（他人备份会被拒绝），并落盘到当前账号
            const { user, room, alerts } = await MessageCache.importBackup(currentUid(), text)

            // 群聊记录：去重合并进内存 Map（落盘已由 importBackup 完成）
            room.forEach(([key, value]) => {
                const roomMessage = socketStore.roomMessageMap.get(key) || []
                socketStore.roomMessageMap.set(key, sortBy(uniqWith([...roomMessage, ...value], isEqual), 'timestamp'))
            })
            // 私聊记录
            user.forEach(([key, value]) => {
                const userMessage = socketStore.userMessageMap.get(key) || []
                socketStore.userMessageMap.set(key, sortBy(uniqWith([...userMessage, ...value], isEqual), 'timestamp'))
            })
            // 系统广播：合并去重后按时间降序（最新在上），replaceAlerts 内部会落盘
            if (alerts.length) {
                const alertStore = useAlertStore()
                alertStore.replaceAlerts(uniqWith([...alertStore.alerts, ...alerts], isEqual))
            }
            toast.success('聊天记录导入成功')
        } catch (error: any) {
            console.error('解析失败:', error)
            toast.error(error?.message || '导入失败')
        } finally {
            input.value = ''  // 允许重复选择同一文件
        }
    })

})

</script>

<style lang="scss" scoped>
.settings {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(720px, 100%);
    /* 全局没有 box-sizing:border-box，height:100% + 上下 padding 会撑出
       父容器（app-main overflow:hidden），内容过高时底部被裁剪且滚不到 */
    box-sizing: border-box;
    height: 100%;
    margin: 0 auto;
    padding: 1.6rem 1.25rem 2rem;
    overflow-y: auto;

    /* 关键：flex column 容器高度固定，空间不足时子项默认 flex-shrink:1 会被
       压缩；而 .settings-card 带 overflow:hidden，被压扁后内部内容（更新时间、
       退出登录按钮等）会被直接裁掉，且因没有真正溢出导致 overflow-y:auto 不滚动。
       锁死子项不收缩，让内容自然撑开并正常滚动，小屏也能滚到底看到完整内容。 */
    >* {
        flex-shrink: 0;
    }
}

@media (max-width: 768px) {
    .settings {
        padding: 1rem 0.85rem calc(1.2rem + env(safe-area-inset-bottom));
    }
}

.account-actions {
    display: flex;
    flex-direction: column;
}

.account-btn {
    justify-content: flex-start;
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
    color: var(--text-3);

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
        box-shadow: 0 0 0 3px var(--accent-soft, var(--surface-3));
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
</style>
