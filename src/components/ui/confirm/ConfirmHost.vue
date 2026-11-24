<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="confirmState.open" class="confirm-layer" @click.self="resolveConfirm(false)">
        <div class="confirm-card" role="alertdialog" aria-modal="true" :aria-label="confirmState.title">
          <h2 class="confirm-title">{{ confirmState.title }}</h2>
          <p class="confirm-message">{{ confirmState.message }}</p>
          <div class="confirm-actions">
            <button type="button" class="btn btn-ghost" @click="resolveConfirm(false)">
              {{ confirmState.cancelText }}
            </button>
            <button type="button" class="btn" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'"
              @click="resolveConfirm(true)">
              {{ confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { confirmState, resolveConfirm } from './index'

/** Esc 取消，与原生 confirm 的键盘习惯一致 */
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') resolveConfirm(false)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.confirm-layer {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: var(--mask-bg);
    backdrop-filter: blur(3px);
}

.confirm-card {
    width: min(100%, 380px);
    padding: 1.35rem 1.4rem 1.2rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
}

.confirm-title {
    margin: 0 0 0.55rem;
    font-size: 1rem;
    font-weight: 600;
}

.confirm-message {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.65;
    color: var(--text-2);
    word-break: break-word;
}

.confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 1.3rem;
}

.confirm-enter-from,
.confirm-leave-to {
    opacity: 0;
}

.confirm-enter-active,
.confirm-leave-active {
    transition: opacity 0.2s ease;
}

.confirm-enter-active .confirm-card,
.confirm-leave-active .confirm-card {
    transition: transform 0.24s var(--ease);
}

.confirm-enter-from .confirm-card,
.confirm-leave-to .confirm-card {
    transform: translateY(8px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
    .confirm-enter-active .confirm-card,
    .confirm-leave-active .confirm-card {
        transition: none;
    }
}
</style>
