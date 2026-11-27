<template>
  <div class="side-shell" :class="{ 'has-detail': hasDetail }">
    <aside ref="sidebarRef" class="side">
      <div class="side-head">
        <div class="ui-field ui-field-sm">
          <span class="ui-field-icon">
            <AppIcon name="search" :size="15" />
          </span>
          <input :value="modelValue" type="text" :placeholder="searchPlaceholder ?? t('common.search')" @input="onInput" />
        </div>
        <slot name="head-actions" />
      </div>

      <div class="side-list">
        <LoadingBlock v-if="loading" :text="loadingText ?? t('common.loading')" />
        <template v-else>
          <button v-for="item in items" :key="itemKey(item)" type="button" class="list-row"
            :class="{ 'is-active': activeId === itemKey(item) }" @click="emit('select', item)">
            <slot name="row" :item="item" />
          </button>
          <EmptyState v-if="empty" :icon="emptyIcon" :text="emptyText ?? t('chat.noData')" />
        </template>
      </div>
    </aside>

    <section class="side-body">
      <slot name="body" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppIcon, LoadingBlock, EmptyState } from '@/components/ui'

const { t } = useI18n()


import { useResizable } from '@/hooks/useResizable'

type PanelIcon = 'search' | 'users' | 'room' | 'house' | 'chat' | 'bell' | 'list' | 'plus' | 'group'

withDefaults(defineProps<{
  modelValue: string
  items?: any[]
  itemKey?: (item: any) => string | number
  activeId?: string | number | undefined
  hasDetail?: boolean
  loading?: boolean
  loadingText?: string
  empty?: boolean
  emptyText?: string
  emptyIcon?: PanelIcon
  searchPlaceholder?: string
}>(), {
  items: () => [],
  itemKey: (item: any) => item?.id,
  hasDetail: false,
  loading: false,
  empty: false,
  emptyIcon: 'list'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [item: any]
}>()

const sidebarRef = ref<HTMLElement | null>(null)
useResizable(sidebarRef, { direction: 'horizontal', minSize: 180, maxSize: 480, initialSize: 240 })

/** 模板里不写 TS 断言（模板表达式按 JS 解析，as 会飘红），断言放到 script 内 */
const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>
