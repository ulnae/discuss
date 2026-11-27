<template>
    <div class="nf-page">
        <div class="nf-card">
            <div class="nf-code" aria-hidden="true">404</div>
            <h1 class="nf-title">{{ t('notfound.title') }}</h1>
            <p class="nf-sub">{{ t('notfound.desc') }}</p>
            <button type="button" class="btn btn-primary" @click="goHome">{{ t('notfound.backHome') }}</button>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const goHome = () => router.push('/')
</script>

<style lang="scss" scoped>
.nf-page {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 1.5rem;
}

.nf-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    padding: 2.5rem 2.25rem 2.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    background: var(--surface-solid);
    box-shadow: var(--shadow-card);
    text-align: center;
    animation: nf-in 0.45s var(--ease) both;
}

@keyframes nf-in {
    from {
        opacity: 0;
        transform: translateY(12px) scale(0.99);
    }

    to {
        opacity: 1;
        transform: none;
    }
}

.nf-code {
    font-size: 3.4rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--text);
    font-variant-numeric: tabular-nums;
}

.nf-title {
    margin-top: 0.35rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
}

.nf-sub {
    margin-bottom: 0.9rem;
    font-size: 0.76rem;
    color: var(--text-2);
}

@media (prefers-reduced-motion: reduce) {
    .nf-card {
        animation: none;
    }
}
</style>
