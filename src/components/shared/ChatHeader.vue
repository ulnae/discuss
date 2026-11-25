<template>
  <header class="chat-head">
    <BackButton :title="backTitle" @click="emit('back')" />
    <div class="chat-head-main">
      <div class="chat-title">{{ title }}</div>
      <div class="chat-sub" :title="subtitle">{{ subtitle }}</div>
    </div>
    <div class="chat-head-actions">
      <button type="button" class="icon-btn" :class="{ 'is-active': infoActive }" :title="infoTitle"
        @click="emit('toggle-info')">
        <AppIcon name="dots" :size="18" :stroke-width="1.6" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { AppIcon, BackButton } from '@/components/ui'


withDefaults(defineProps<{
  title: string
  subtitle?: string
  backTitle?: string
  infoTitle?: string
  infoActive?: boolean
}>(), {
  subtitle: '',
  backTitle: '返回',
  infoTitle: '详情',
  infoActive: false
})

const emit = defineEmits<{
  back: []
  'toggle-info': []
}>()
</script>
