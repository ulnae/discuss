<template>
    <Teleport to="body">
        <TransitionGroup name="toast" tag="div" class="toast-layer" role="region" aria-live="polite">
            <div
                v-for="item in toastState.items"
                :key="item.id"
                class="toast-item"
                :class="`toast-${item.type}`"
                role="status"
            >
                <span class="toast-icon" v-html="ICONS[item.type]"></span>
                <span class="toast-text">{{ item.message }}</span>
                <button type="button" class="toast-close" :aria-label="t('common.close')" @click="dismissToast(item.id)">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                        stroke-width="2.4" stroke-linecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </TransitionGroup>
    </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { toastState, dismissToast, type ToastType } from './index'

const { t } = useI18n()

const ICONS: Record<ToastType, string> = {
    success: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.3 4.3L19 7.2"/></svg>`,
    error: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5 2.9 20h18.2L12 4.5Z"/><path d="M12 10v4M12 17h.01"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11v5M12 7.8h.01"/></svg>`
}
</script>

<style scoped>
.toast-layer {
    position: fixed;
    top: 1.1rem;
    right: 1.1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: min(350px, calc(100vw - 2rem));
    pointer-events: none;
}

/* 玻璃拟态卡片：颜色/圆角/阴影全部走主题变量，明暗模式自动适配 */
.toast-item {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-height: 3.1rem;
    padding: 0.7rem 0.7rem 0.7rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(18px) saturate(1.5);
    -webkit-backdrop-filter: blur(18px) saturate(1.5);
    color: var(--text);
    pointer-events: auto;
}

/* 状态徽章：柔和底色 + 状态色图标，取代原来的左侧色条 */
.toast-icon {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    color: var(--toast-accent);
    background: var(--toast-accent-soft);
}

.toast-text {
    flex: 1;
    min-width: 0;
    font-size: 0.84rem;
    font-weight: 500;
    line-height: 1.5;
    word-break: break-word;
}

.toast-close {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: var(--text-3);
    background: transparent;
    cursor: pointer;
    transition: color 0.18s ease, background-color 0.18s ease;
}

.toast-close:hover {
    color: var(--text);
    background: var(--surface-3);
}

/* 主色复用全局状态色（success/warning/info），soft 底与 error 用 Toast 专属变量 */
.toast-success { --toast-accent: var(--success); --toast-accent-soft: var(--toast-success-soft); }
.toast-error   { --toast-accent: var(--toast-error); --toast-accent-soft: var(--toast-error-soft); }
.toast-warning { --toast-accent: var(--warning); --toast-accent-soft: var(--toast-warning-soft); }
.toast-info    { --toast-accent: var(--info); --toast-accent-soft: var(--toast-info-soft); }

/* 进出场动效 */
.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateX(20px) scale(0.96);
}

.toast-enter-active,
.toast-leave-active {
    transition: opacity 0.3s ease, transform 0.32s var(--ease);
}

.toast-move {
    transition: transform 0.32s var(--ease);
}

@media (prefers-reduced-motion: reduce) {

    .toast-enter-from,
    .toast-leave-to {
        transform: none;
    }
}
</style>
