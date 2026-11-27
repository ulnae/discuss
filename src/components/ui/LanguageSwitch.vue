<template>
    <div class="lang-switch" role="group" :aria-label="t('lang.label')">
        <button v-for="item in LOCALES" :key="item.value" type="button"
            :class="{ 'is-active': locale === item.value }" @click="switchLocale(item.value)">
            {{ item.label }}
        </button>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALES, switchLocale } from '@/locales'

const { t, locale } = useI18n()
</script>

<style lang="scss" scoped>
/* 分段式语言切换：登录卡片与设置行共用，尺寸跟随上下文字号 */
.lang-switch {
    display: inline-flex;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface-2);
    gap: 2px;
}

.lang-switch button {
    height: 1.7rem;
    padding: 0 0.7rem;
    font-size: 0.74rem;
    color: var(--text-2);
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    transition: color 0.18s ease, background-color 0.18s ease;

    &.is-active {
        color: var(--text);
        background: var(--surface-3);
        font-weight: 500;
    }

    &:not(.is-active):hover {
        color: var(--text);
    }
}
</style>
