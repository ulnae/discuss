<template>
    <div class="dashboard">
        <header class="welcome">
            <div class="welcome-logo" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.4A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4Z" />
                    <path d="M8.5 11.5h7M8.5 8.5h4" />
                </svg>
            </div>
            <h1 class="welcome-title">欢迎使用 Discuss</h1>
            <p class="welcome-sub">从左侧选择好友或房间，开始一段对话</p>
        </header>

        <section class="notice">
            <header class="notice-head">
                <span>系统通知</span>
                <span v-if="alertStore.alerts.length" class="chip">{{ alertStore.alerts.length }}</span>
            </header>

            <div v-if="alertStore.alerts.length === 0" class="empty">
                <span class="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                        <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                    </svg>
                </span>
                暂无通知，一切都安静
            </div>

            <div v-else class="notice-list">
                <div v-for="(item, idx) in alertStore.alerts" :key="idx" class="notice-row">
                    <span class="notice-sender">{{ item.sender }}</span>
                    <span class="notice-text">{{ item.message }}</span>
                    <span class="notice-time">{{ dayjs(item.timestamp).format('MM/DD HH:mm') }}</span>
                    <button type="button" class="icon-btn notice-del" title="删除这条通知"
                        @click="alertStore.alerts.splice(idx, 1)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
                            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { useAlertStore } from '@/store/modules/alert'
import dayjs from 'dayjs';

const alertStore = useAlertStore()
</script>

<style lang="scss" scoped>
.dashboard {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    height: 100%;
    padding: 1.75rem 1.25rem 2rem;
    overflow-y: auto;
}

.welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 2rem 1rem 1.75rem;
    text-align: center;
}

.welcome-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    margin-bottom: 0.7rem;
    border-radius: 15px;
    color: var(--accent-fg);
    background: var(--accent);
    box-shadow: var(--shadow-accent);
}

.welcome-title {
    font-size: 1.2rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--text);
}

.welcome-sub {
    font-size: 0.78rem;
    color: var(--text-2);
}

.notice {
    width: min(620px, 100%);
    margin: 0 auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    overflow: hidden;
}

.notice-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 0.9rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text);
    border-bottom: 1px solid var(--border);
}

.notice-list {
    display: flex;
    flex-direction: column;
}

.notice-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.6rem 0.8rem;
    font-size: 0.78rem;
    transition: background-color 0.16s ease;

    &+.notice-row {
        border-top: 1px solid var(--border);
    }

    &:hover {
        background: var(--surface-3);

        .notice-del {
            opacity: 1;
        }
    }
}

.notice-sender {
    flex-shrink: 0;
    padding: 0.1rem 0.4rem;
    border-radius: 6px;
    background: var(--surface-3);
    color: var(--text-2);
    font-size: 0.68rem;
}

.notice-text {
    flex: 1;
    min-width: 0;
    color: var(--text);
    word-break: break-word;
}

.notice-time {
    flex-shrink: 0;
    font-size: 0.68rem;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
}

.notice-del {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    opacity: 0;
    transition: opacity 0.16s ease, color 0.16s ease, background-color 0.16s ease;

    svg {
        width: 13px;
        height: 13px;
    }

    &:hover {
        color: var(--danger);
        background: rgba(225, 29, 72, 0.1);
    }
}
</style>
