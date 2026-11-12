<template>
    <div class="login-page">
        <!-- 背景光斑，纯装饰 -->
        <div class="login-aurora" aria-hidden="true">
            <span class="blob blob-a"></span>
            <span class="blob blob-b"></span>
        </div>

        <div class="login-card">
            <header class="login-head">
                <div class="login-logo" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.4A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4Z" />
                        <path d="M8.5 11.5h7M8.5 8.5h4" />
                    </svg>
                </div>
                <h1 class="login-title">{{ activeTab ? '创建账号' : '欢迎回来' }}</h1>
                <p class="login-sub">{{ activeTab ? '注册后即可加入房间、添加好友' : '登录后继续你的对话' }}</p>
            </header>

            <div class="login-tabs" role="tablist" aria-label="登录或注册">
                <span class="login-tab-thumb" :class="{ 'is-right': activeTab }"></span>
                <button type="button" role="tab" :aria-selected="!activeTab" :class="{ 'is-active': !activeTab }"
                    @click="switchTab(false)">登录</button>
                <button type="button" role="tab" :aria-selected="activeTab" :class="{ 'is-active': activeTab }"
                    @click="switchTab(true)">注册</button>
            </div>

            <form class="login-form" novalidate @submit.prevent="handleLogin">
                <label class="field">
                    <span class="field-label">用户名</span>
                    <div class="field-box">
                        <svg class="field-icon" viewBox="0 0 24 24" width="16" height="16" fill="none"
                            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="8" r="3.6" />
                            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
                        </svg>
                        <input v-model.trim="loginForm.username" type="text" name="username" autocomplete="username"
                            placeholder="请输入用户名" />
                    </div>
                </label>

                <label class="field">
                    <span class="field-label">密码</span>
                    <div class="field-box">
                        <svg class="field-icon" viewBox="0 0 24 24" width="16" height="16" fill="none"
                            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="4" y="10" width="16" height="10" rx="2.5" />
                            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
                        </svg>
                        <input v-model.trim="loginForm.password" type="password" name="password"
                            :autocomplete="activeTab ? 'new-password' : 'current-password'" placeholder="请输入密码" />
                    </div>
                </label>

                <label v-if="activeTab" class="field">
                    <span class="field-label">邮箱</span>
                    <div class="field-box">
                        <svg class="field-icon" viewBox="0 0 24 24" width="16" height="16" fill="none"
                            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="5" width="18" height="14" rx="2.5" />
                            <path d="m3.8 6.8 7.1 5.2a2 2 0 0 0 2.2 0l7.1-5.2" />
                        </svg>
                        <input v-model.trim="loginForm.email" type="email" name="email" autocomplete="email"
                            placeholder="用于找回账号（可选）" />
                    </div>
                </label>

                <label class="field">
                    <span class="field-label">验证码</span>
                    <div class="field-row">
                        <div class="field-box">
                            <svg class="field-icon" viewBox="0 0 24 24" width="16" height="16" fill="none"
                                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" />
                                <path d="m9.2 12 2 2 3.6-3.8" />
                            </svg>
                            <input v-model.trim="loginForm.captcha" type="text" name="captcha" maxlength="6"
                                autocomplete="off" placeholder="请输入验证码" />
                        </div>
                        <button type="button" class="captcha-box" title="看不清？点击刷新" :disabled="captchaLoading"
                            @click="handleGetCaptcha">
                            <span v-if="captchaLoading" class="captcha-loading">···</span>
                            <span v-else v-html="captchaImg"></span>
                        </button>
                    </div>
                </label>

                <button type="submit" class="submit" :disabled="submitting">
                    <span v-if="submitting" class="spinner" aria-hidden="true"></span>
                    <span>{{ submitting ? (activeTab ? '注册中…' : '登录中…') : (activeTab ? '注册并登录' : '登录') }}</span>
                </button>
            </form>

            <p class="login-foot">
                {{ activeTab ? '已有账号？' : '还没有账号？' }}
                <button type="button" @click="switchTab(!activeTab)">{{ activeTab ? '去登录' : '立即注册' }}</button>
            </p>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useUserStore } from '@/store/modules/user'
import router from '@/router'
import serverApi from '@/api'
import { toast } from '@/components/ui/toast'

const activeTab = ref(false)
const submitting = ref(false)
const captchaLoading = ref(false)

const userStore = useUserStore()
const loginForm = reactive({
    captcha: '',
    username: '',
    password: '',
    email: ''
})
const captchaImg = ref('')

function switchTab(isRegister: boolean) {
    if (activeTab.value === isRegister) return
    activeTab.value = isRegister
    loginForm.captcha = ''
    handleGetCaptcha()
}

async function handleLogin() {
    if (submitting.value) return

    if (!loginForm.username || !loginForm.password) {
        toast.warning('请输入用户名和密码')
        return
    }
    if (activeTab.value && !loginForm.email) {
        toast.warning('请输入邮箱')
        return
    }
    if (!loginForm.captcha) {
        toast.warning('请输入验证码')
        return
    }

    submitting.value = true
    const isRegister = activeTab.value
    try {
        const res: any = await serverApi[isRegister ? 'Register' : 'Login'](loginForm)

        if (isRegister) {
            toast.success('注册成功，请使用刚才的账号登录')
            activeTab.value = false
            loginForm.captcha = ''
            loginForm.password = ''
            handleGetCaptcha()
            return
        }

        await userStore.login(res.data)
        toast.success('登录成功，欢迎回来')
        router.push('/')
    } catch {
        /* 错误提示已由 axios 拦截器统一弹出，这里只需要刷新验证码 */
        loginForm.captcha = ''
        handleGetCaptcha()
    } finally {
        submitting.value = false
    }
}

function handleGetCaptcha() {
    loginForm.captcha = ''
    captchaLoading.value = true
    serverApi.GetCaptcha().then((res: any) => {
        captchaImg.value = res
    }).catch(() => {
        captchaImg.value = ''
        toast.error('验证码加载失败，请点击重试')
    }).finally(() => {
        captchaLoading.value = false
    })
}

handleGetCaptcha()
</script>

<style lang="scss" scoped>
.login-page {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 1.5rem 1rem;
    overflow: hidden;
    background: radial-gradient(120% 120% at 50% 0%, #f7f8fa 0%, #eef0f4 55%, #e7e9ee 100%);
}

.login-aurora {
    position: absolute;
    inset: 0;
    pointer-events: none;

    .blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.55;
    }

    .blob-a {
        width: 420px;
        height: 420px;
        top: -160px;
        left: -120px;
        background: rgba(160, 174, 192, 0.55);
    }

    .blob-b {
        width: 380px;
        height: 380px;
        right: -140px;
        bottom: -160px;
        background: rgba(203, 213, 225, 0.6);
    }
}

.login-card {
    position: relative;
    z-index: 1;
    width: min(400px, 100%);
    padding: 2rem 1.75rem 1.5rem;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow:
        0 28px 70px -30px rgba(15, 23, 42, 0.35),
        0 2px 10px rgba(15, 23, 42, 0.04);
    backdrop-filter: blur(18px) saturate(1.5);
    animation: card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes card-in {
    from {
        opacity: 0;
        transform: translateY(14px) scale(0.985);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

.login-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 1.35rem;
}

.login-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    margin-bottom: 0.85rem;
    border-radius: 13px;
    color: #fff;
    background: #111;
    box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.6);
}

.login-title {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: #111827;
}

.login-sub {
    margin-top: 0.3rem;
    font-size: 0.78rem;
    color: #6b7280;
}

.login-tabs {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 4px;
    margin-bottom: 1.15rem;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.055);
}

.login-tab-thumb {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc(50% - 4px);
    border-radius: 9px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14);
    transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);

    &.is-right {
        transform: translateX(100%);
    }
}

.login-tabs button {
    position: relative;
    z-index: 1;
    height: 2.15rem;
    font-size: 0.82rem;
    color: #6b7280;
    background: transparent;
    border: 0;
    cursor: pointer;
    transition: color 0.2s ease;

    &.is-active {
        color: #111827;
        font-weight: 500;
    }

    &:not(.is-active):hover {
        color: #374151;
    }
}

.login-form {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
}

.field {
    display: block;
}

.field-label {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: #6b7280;
}

.field-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 2.7rem;
    padding: 0 0.75rem;
    border-radius: 11px;
    background: rgba(15, 23, 42, 0.04);
    border: 1px solid transparent;
    transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

    &:focus-within {
        background: #fff;
        border-color: rgba(17, 24, 39, 0.28);
        box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.05);
    }
}

.field-icon {
    flex-shrink: 0;
    color: #9ca3af;
    transition: color 0.2s ease;

    .field-box:focus-within & {
        color: #4b5563;
    }
}

.field-box input {
    flex: 1;
    min-width: 0;
    height: 100%;
    font-size: 0.85rem;
    color: #111827;
    background: transparent;
    border: 0;
    outline: none;

    &::placeholder {
        color: #9ca3af;
    }

    &:-webkit-autofill {
        -webkit-text-fill-color: #111827;
        transition: background-color 9999s ease-out;
    }
}

.field-row {
    display: flex;
    gap: 0.6rem;

    .field-box {
        flex: 1;
        min-width: 0;
    }
}

.captcha-box {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 112px;
    height: 2.7rem;
    padding: 0;
    overflow: hidden;
    border-radius: 11px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.1);
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:hover:not(:disabled) {
        border-color: rgba(17, 24, 39, 0.3);
        box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.04);
    }

    &:disabled {
        cursor: default;
    }

    :deep(svg) {
        width: 100%;
        height: 100%;
        display: block;
    }
}

.captcha-loading {
    font-size: 0.9rem;
    letter-spacing: 0.2em;
    color: #9ca3af;
}

.submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 2.75rem;
    margin-top: 0.35rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #fff;
    background: #111;
    border: 0;
    border-radius: 11px;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.12s ease, opacity 0.2s ease;

    &:hover:not(:disabled) {
        background: #000;
    }

    &:active:not(:disabled) {
        transform: scale(0.985);
    }

    &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
}

.spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.login-foot {
    margin-top: 1rem;
    text-align: center;
    font-size: 0.75rem;
    color: #6b7280;

    button {
        padding: 0;
        margin-left: 0.25rem;
        font-size: 0.75rem;
        color: #111827;
        background: none;
        border: 0;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 3px;
        text-decoration-color: rgba(17, 24, 39, 0.3);

        &:hover {
            text-decoration-color: #111827;
        }
    }
}

/* ---------- 深色模式见文件底部的非 scoped 样式块 ---------- */

@media (max-width: 420px) {
    .login-card {
        padding: 1.6rem 1.25rem 1.25rem;
        border-radius: 16px;
    }

    .captcha-box {
        width: 96px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .login-card {
        animation: none;
    }

    .login-tab-thumb {
        transition: none;
    }
}
</style>

<style lang="scss">
/* 深色模式：单独放非 scoped 块。当前构建（rolldown-vite）对 scoped 样式里的
   `:global(.dark) .xxx` 编译会把后代选择器丢掉，深色规则整段失效。
   login-/field-/captcha-/submit 前缀类名在本页全局唯一，直接写全局选择器。 */
.dark .login-page {
    background: radial-gradient(120% 120% at 50% 0%, #1c1c1f 0%, #141416 55%, #0e0e10 100%);
}

.dark .login-aurora .blob-a {
    background: rgba(63, 63, 70, 0.55);
}

.dark .login-aurora .blob-b {
    background: rgba(39, 39, 42, 0.65);
}

.dark .login-card {
    background: rgba(24, 24, 27, 0.82);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow:
        0 28px 70px -30px rgba(0, 0, 0, 0.85),
        0 2px 10px rgba(0, 0, 0, 0.4);
}

.dark .login-logo {
    color: #111;
    background: #fafafa;
    box-shadow: 0 8px 20px -8px rgba(255, 255, 255, 0.35);
}

.dark .login-title {
    color: #f4f4f5;
}

.dark .login-sub,
.dark .login-foot {
    color: #a1a1aa;
}

.dark .login-tabs {
    background: rgba(255, 255, 255, 0.06);
}

.dark .login-tab-thumb {
    background: rgba(255, 255, 255, 0.14);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.dark .login-tabs button {
    color: #a1a1aa;

    &.is-active {
        color: #f4f4f5;
    }

    &:not(.is-active):hover {
        color: #d4d4d8;
    }
}

.dark .field-label {
    color: #a1a1aa;
}

.dark .field-box {
    background: rgba(255, 255, 255, 0.06);

    &:focus-within {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.28);
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
    }
}

.dark .field-icon {
    color: #71717a;
}

.dark .field-box:focus-within .field-icon {
    color: #d4d4d8;
}

.dark .field-box input {
    color: #f4f4f5;

    &::placeholder {
        color: #71717a;
    }

    &:-webkit-autofill {
        -webkit-text-fill-color: #f4f4f5;
    }
}

.dark .captcha-box {
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.12);

    &:hover:not(:disabled) {
        border-color: rgba(255, 255, 255, 0.35);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
    }
}

.dark .submit {
    color: #111;
    background: #fafafa;

    &:hover:not(:disabled) {
        background: #fff;
    }
}

.dark .spinner {
    border-color: rgba(0, 0, 0, 0.25);
    border-top-color: #111;
}

.dark .login-foot button {
    color: #f4f4f5;
    text-decoration-color: rgba(255, 255, 255, 0.35);

    &:hover {
        text-decoration-color: #fff;
    }
}
</style>
