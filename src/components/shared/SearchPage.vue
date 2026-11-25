<template>
  <div class="search-page">
    <BackButton class="page-back" :title="backTitle" @click="emit('back')" />

    <header class="search-head">
      <h1 class="search-title">{{ title }}</h1>
      <p class="search-sub">{{ subtitle }}</p>

      <div class="ui-field search-field">
        <span class="ui-field-icon">
          <AppIcon name="search" :size="16" />
        </span>
        <input :value="modelValue" type="text" :placeholder="placeholder" @input="onInput"
          @keyup.enter="emit('submit', modelValue)" />
        <button type="button" class="btn btn-primary btn-sm" @click="emit('submit', modelValue)">搜索</button>
      </div>
    </header>

    <div class="search-body">
      <EmptyState v-if="!results.length" :icon="emptyIcon" :text="emptyText" />
      <template v-for="item in results" :key="itemKey(item)">
        <slot name="result" :item="item" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AppIcon, BackButton, EmptyState } from '@/components/ui'



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
}>(), {
  backTitle: '返回',
  emptyText: '搜索结果会显示在这里',
  emptyIcon: 'search',
  results: () => [],
  itemKey: (item: any) => item?.id
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
