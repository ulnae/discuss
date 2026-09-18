<template lang="">
    <div class="login w-full h-full ">
        <div class="fixed top-1/2 scale-80 w-[400px] left-1/2 shadow-lg dark:shadow-white/10 -translate-x-1/2 flex flex-col gap-8 -translate-y-1/2  px-10 py-10 rounded-xl animate__pulse animate__animated">
            <div class="relative flex w-full h-10 rounded-lg overflow-hidden bg-black/10 dark:bg-white/10">
                <div
                    class="absolute top-0 left-0 h-full w-1/2 rounded-lg bg-white dark:bg-black border border-black/25 dark:border-white/25 backdrop-blur-sm transition-transform duration-300 ease-out"
                    :class="activeTab ? 'translate-x-full' : 'translate-x-0'"
                ></div>
                <button
                    type="button"
                    class="relative z-10 flex-1 flex items-center justify-center text-sm   duration-300 cursor-pointer"
                    :class="!activeTab ? 'font-medium' : 'text-black/50 dark:text-white/50'"
                    @click="activeTab = false"
                >登录</button>
                <button
                    type="button"
                    class="relative z-10 flex-1 flex items-center justify-center text-sm   duration-300 cursor-pointer"
                    :class="activeTab ? 'font-medium' : 'text-black/50 dark:text-white/50'"
                    @click="activeTab = true"
                >注册</button>
            </div>

            <input type="text" class="input" placeholder="用户名" v-model.trim="loginForm.username">
            <input type="password" class="input" placeholder="密码" @keydown.enter="handleLogin" v-model.trim="loginForm.password">
            <input type="text" class="input" placeholder="邮箱" @keydown.enter="handleLogin" v-if="activeTab" v-model.trim="loginForm.email">
            <div class="flex items-center gap-2 w-full">
                <input type="text" class="input flex-1 w-[50%]" placeholder="验证码" @keydown.enter="handleLogin" v-model.trim="loginForm.captcha">
                <div v-html="captchaImg"  class="h-[40px] captchaImg cursor-pointer dark:bg-white/50" @click="handleGetCaptcha"></div>
            </div>
            <button type="submit" @click="handleLogin">提交</button>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useUserStore } from '@/store/modules/user'
import router from '@/router'
import serverApi from '@/api'
// https://uiverse.io/elements?tags=neumorphism&page=2

const activeTab = ref(false)

const userStore = useUserStore()
const loginForm = reactive({
    captcha: '',
    username: '',
    password: '',
    email: ''
})
const captchaImg = ref('')


const handleLogin = () => {
    if (!loginForm.username || !loginForm.password) {
        return
    }
    if (activeTab.value && !loginForm.email) {
        return
    }
    serverApi[activeTab.value ? 'Register' : 'Login'](loginForm).then(async (res: any) => {
        !activeTab.value && await userStore.login(res.data)
        !activeTab.value && router.push('/')
        if (activeTab.value) {
            activeTab.value = false
        }
    })
}

function handleGetCaptcha() {
    loginForm.captcha = ''
    serverApi.GetCaptcha().then((res: any) => {
        captchaImg.value = res
    })
}
handleGetCaptcha()

</script>
<style lang="scss">
.captchaImg {
    svg {
        height: 100%;
    }
}

.login {
    .input {
        height: 2.5rem;
        padding: 0 0.75rem;
        font-size: 0.875rem;
        color: #000;
        background-color: rgba(255, 255, 255, 0.8);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.5rem;
        outline: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        &::placeholder {
            color: rgba(0, 0, 0, 0.4);
        }

        &:focus {
            border-color: rgba(0, 0, 0, 0.3);
            background-color: #fff;
            box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
        }
    }

    button[type="submit"] {
        height: 2.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #fff;
        background-color: #000;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
            background-color: rgba(0, 0, 0, 0.85);
        }

        &:active {
            transform: scale(0.98);
        }
    }
}

.dark {
    .login {
        .input {
            background-color: rgba(255, 255, 255, 0.2);

            &::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }

            &:focus {
                border-color: rgba(255, 255, 255, 0.3);
                background-color: #000;
                box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.05);
            }
        }

        button[type="submit"] {
            color: #000;
            background-color: #fff;

            &:hover {
                background-color: rgba(255, 255, 255, 0.85);
            }
        }
    }
}
</style>