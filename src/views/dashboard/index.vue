<template>
    <div class="dashboard">
        <header class="welcome">
            <div class="welcome-logo" aria-hidden="true">
                <AppIcon name="chat" :size="22" />
            </div>
            <h1 class="welcome-title">{{ t('dash.welcomeTitle') }}</h1>
            <p class="welcome-sub">{{ t('dash.welcomeSub') }}</p>
        </header>

        <section class="notice">
            <header class="notice-head">
                <span>{{ t('dash.alerts') }}</span>
                <span v-if="alertStore.alerts.length" class="chip">{{ alertStore.alerts.length }}</span>
            </header>

            <EmptyState v-if="alertStore.alerts.length === 0" icon="bell" :text="t('dash.noAlerts')" />

            <div v-else class="notice-list">
                <div v-for="(item, idx) in alertStore.alerts" :key="`${item.timestamp}-${item.senderName}-${item.message}`"
                    class="notice-row">
                    <span class="notice-sender">{{ item.senderName }}</span>
                    <span class="notice-text">{{ item.message }}</span>
                    <span class="notice-time">{{ formatShortTime(item.timestamp) }}</span>
                    <button type="button" class="icon-btn notice-del" :title="t('dash.deleteNotice')"
                        @click="alertStore.removeAlert(idx)">
                        <AppIcon name="close" :size="15" />
                    </button>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { useAlertStore } from '@/store/modules/alert'
import { AppIcon, EmptyState } from '@/components/ui'
import { useI18n } from 'vue-i18n'


import { formatShortTime } from '@/utils/format'

const { t } = useI18n()
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
    color: var(--brand-fg);
    background: var(--brand-bg);
    box-shadow: var(--brand-shadow);
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
    color: var(--text);
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
    color: var(--text-2);
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
        background: var(--danger-soft);
    }
}
</style>
