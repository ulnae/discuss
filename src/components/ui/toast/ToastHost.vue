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
                <button type="button" class="toast-close" aria-label="关闭提示" @click="dismissToast(item.id)">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                        stroke-width="2.2" stroke-linecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
                <span class="toast-progress" :style="{ animationDuration: `${item.duration}ms` }"></span>
            </div>
        </TransitionGroup>
    </Teleport>
</template>

<script setup lang="ts">
import { toastState, dismissToast, type ToastType } from './index'

const ICONS: Record<ToastType, string> = {
    success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>`,
    error: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M12 8v4.5M12 16h.01"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" opacity=".25"/><path d="M12 9.5v4M12 17h.01"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M12 11v5M12 8h.01"/></svg>`
}
</script>

<style scoped>
.toast-layer {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: min(360px, calc(100vw - 2rem));
    pointer-events: none;
}

.toast-item {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.7rem 0.75rem 0.7rem 0.9rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.97);
    border: 1px solid rgba(0, 0, 0, 0.07);
    box-shadow: 0 12px 32px -10px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(12px);
    overflow: hidden;
    pointer-events: auto;
    font-size: 0.8125rem;
    line-height: 1.55;
    color: #1f2937;
}

/* 左侧状态色条 */
.toast-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--toast-accent);
}

.toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
    color: var(--toast-accent);
}

.toast-text {
    flex: 1;
    min-width: 0;
    word-break: break-word;
}

.toast-close {
    flex-shrink: 0;
    margin-top: 1px;
    padding: 2px;
    border: 0;
    border-radius: 0.3rem;
    background: transparent;
    color: currentColor;
    opacity: 0.35;
    cursor: pointer;
    transition: opacity 0.18s ease, background-color 0.18s ease;
}

.toast-close:hover {
    opacity: 0.8;
    background: rgba(0, 0, 0, 0.06);
}

.toast-progress {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 2px;
    width: 100%;
    background: var(--toast-accent);
    opacity: 0.4;
    transform-origin: left center;
    animation-name: toast-progress;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
}

@keyframes toast-progress {
    from { transform: scaleX(1); }
    to { transform: scaleX(0); }
}

.toast-success { --toast-accent: #10b981; }
.toast-error { --toast-accent: #f43f5e; }
.toast-warning { --toast-accent: #f59e0b; }
.toast-info { --toast-accent: #0ea5e9; }

/* 进出场动效 */
.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateX(18px) scale(0.97);
}

.toast-enter-active,
.toast-leave-active {
    transition: opacity 0.26s ease, transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-move {
    transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
    .toast-enter-from,
    .toast-leave-to {
        transform: none;
    }
    .toast-progress {
        display: none;
    }
}
</style>

<style lang="scss">
/* 深色模式单独放非 scoped 块：当前构建（rolldown-vite）对 scoped 样式里的
   `:global(.dark) .xxx` 编译会把后代选择器丢掉，深色规则会整段失效。
   toast- 前缀类名全局唯一，非 scoped 不会误伤其他组件。 */
.dark .toast-item {
    background: rgba(24, 24, 27, 0.96);
    border-color: rgba(255, 255, 255, 0.1);
    color: #e5e7eb;
    box-shadow: 0 12px 32px -10px rgba(0, 0, 0, 0.65), 0 2px 6px rgba(0, 0, 0, 0.35);
}

.dark .toast-close:hover {
    background: rgba(255, 255, 255, 0.1);
}
</style>
