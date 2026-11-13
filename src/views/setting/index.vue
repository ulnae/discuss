<template>
    <div class="settings">
        <header class="settings-head">
            <h1 class="settings-title">设置</h1>
            <p class="settings-sub">账号信息与本地聊天记录</p>
        </header>

        <section class="settings-card">
            <header class="card-head">账号信息</header>
            <div class="kv">
                <div v-for="row in accountRows" :key="row.k" class="kv-row">
                    <span class="kv-k">{{ row.k }}</span>
                    <span class="kv-v">{{ row.v }}</span>
                </div>
            </div>
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

        <section class="settings-card">
            <header class="card-head">关于</header>
            <div class="kv">
                <div class="kv-row">
                    <span class="kv-k">构建时间</span>
                    <span class="kv-v">{{ __COMMIT_INFO__.time }}</span>
                </div>
                <div class="kv-row">
                    <span class="kv-k">作者</span>
                    <span class="kv-v">{{ __COMMIT_INFO__.author }}</span>
                </div>
                <div class="kv-row">
                    <span class="kv-k">提交</span>
                    <span class="kv-v mono">{{ __COMMIT_INFO__.hash }}</span>
                </div>
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
import { useDBStore } from '@/store/modules/database'
import { useSocketStore } from '@/store/modules/socket'
import { downloadJSON } from '@/utils/index'
import { toast } from '@/components/ui/toast'
import { computed, onMounted, reactive } from 'vue'
import { sortBy, uniqWith, isEqual } from 'lodash-es';
import { useTheme } from '@/hooks/theme'
const userStore = useUserStore()
const socketStore = useSocketStore()

// 移动端底部栏放不下主题/退出，收进设置页
const { theme, toggleTheme } = useTheme()
const handleLogout = () => userStore.logout()

const dbStore = useDBStore()

const __COMMIT_INFO__ = reactive({
    hash: __COMMIT_HASH__,
    author: __COMMIT_AUTHOR__,
    time: __COMMIT_TIME__
})

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

const handleExport = () => {
    console.log('export', dbStore)
    let _obj: any = {}
    dbStore.database?.iterate(function (value, key, iterationNumber) {
        // 此回调函数将对所有 key/value 键值对运行
        _obj[key] = Object.fromEntries(value as any)
    }).then(function () {
        console.log('Iteration has completed');
        downloadJSON(_obj, `${userStore.userInfo.id}.json`)
        toast.success('聊天记录已导出')
    }).catch(function (err) {
        // 当出错时，此处代码运行
        console.log(err);
    });
}

const handleImport = () => {
    document.getElementById('chooseHistoryFile')?.click()
}


onMounted(() => {
    document.getElementById('chooseHistoryFile')?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return;
        if (!file.name.startsWith(userStore.userInfo.id as string)) {
            toast.warning('请导入您自己的聊天记录')
            return
        }

        try {
            const text = await file.text(); // 读取文件内容为文本
            const { Room_Message, User_Message } = JSON.parse(text);   // 解析 JSON
            // 解析合并群聊天记录
            Object.entries(Room_Message).forEach(([key, value]: any) => {
                let roomMessage = socketStore.roomMessageMap.get(key)
                const unique = uniqWith([...(roomMessage as []), ...value], isEqual)
                socketStore.roomMessageMap.set(key, sortBy(unique, 'timestamp'))
            });
            // 解析合并好友聊天记录
            Object.entries(User_Message).forEach(([key, value]: any) => {
                let userMessage = socketStore.userMessageMap.get(key)
                const unique = uniqWith([...(userMessage as []), ...value], isEqual)
                socketStore.userMessageMap.set(key, sortBy(unique, 'timestamp'))
            });
            toast.success('聊天记录导入成功')
        } catch (error) {
            console.error('解析失败:', error);
            toast.error('文件内容不是有效的 JSON 格式');
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
}

/* 外观与账号卡片：桌面端底部栏已有主题/退出，只在移动端展示 */
.settings-account {
    display: none;
}

@media (max-width: 768px) {
    .settings {
        padding: 1rem 0.85rem calc(1.2rem + env(safe-area-inset-bottom));
    }

    .settings-account {
        display: block;
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
}

.card-desc {
    padding: 0.75rem 1rem 0;
    font-size: 0.74rem;
    line-height: 1.6;
    color: var(--text-2);
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

.kv-v.mono {
    font-variant-numeric: tabular-nums;
}

.auto-wrap {
    word-wrap: break-word;
    word-break: break-word;
    white-space: break-spaces;
}
</style>
