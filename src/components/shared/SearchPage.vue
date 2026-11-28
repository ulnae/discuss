<template>
  <div class="search-page">
    <BackButton class="page-back" :title="backTitle ?? t('common.back')" @click="emit('back')" />

    <header class="search-head">
      <h1 class="search-title">{{ title }}</h1>
      <p class="search-sub">{{ subtitle }}</p>

      <div class="ui-field search-field">
        <span class="ui-field-icon">
          <AppIcon name="search" :size="16" />
        </span>
        <input :value="modelValue" type="text" :placeholder="placeholder" @input="onInput"
          @keyup.enter="emit('submit', modelValue)" />
        <button type="button" class="btn btn-primary btn-sm" :disabled="loading" @click="emit('submit', modelValue)">{{ loading ? t('common.searching') : t('common.search') }}</button>
      </div>
    </header>

    <div class="search-body">
      <LoadingBlock v-if="loading" class="list-loading" :text="t('common.searching')" />
      <EmptyState v-else-if="!results.length" :icon="emptyIcon" :text="emptyText ?? t('chat.searchEmpty')" />
      <template v-else>
        <template v-for="item in results" :key="itemKey(item)">
          <slot name="result" :item="item" />
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AppIcon, BackButton, EmptyState, LoadingBlock } from '@/components/ui'

const { t } = useI18n()


type ResultIcon = 'search' | 'users' | 'room' | 'house' | 'chat' | 'bell' | 'list' | 'plus' | 'group'

withDefaults(defineProps<{
  modelValue: string
  title: string
  subtitle: string
  placeholder: string
  backTitle?: string
  emptyText?: string
  emptyIcon?: ResultIcon
  results?: any[]
  itemKey?: (item: any) => string | number
  loading?: boolean
}>(), {
  emptyIcon: 'search',
  results: () => [],
  itemKey: (item: any) => item?.id,
  loading: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [keyword: string]
  back: []
}>()

/** 模板里不写 TS 断言（模板表达式按 JS 解析，as 会飘红），断言放到 script 内 */
const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.search-body {
  display: flex;
  flex-direction: column;
}

.search-body > .list-loading {
  flex: 1;
}
</style>
