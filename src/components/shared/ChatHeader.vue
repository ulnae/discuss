<template>
  <header class="chat-head">
    <BackButton :title="backTitle ?? t('common.back')" @click="emit('back')" />
    <div class="chat-head-main">
      <div class="chat-title">{{ title }}</div>
      <div class="chat-sub" :title="subtitle">{{ subtitle }}</div>
    </div>
    <div class="chat-head-actions">
      <button type="button" class="icon-btn" :class="{ 'is-active': infoActive }" :title="infoTitle ?? t('chat.details')"
        @click="emit('toggle-info')">
        <AppIcon name="dots" :size="18" :stroke-width="1.6" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AppIcon, BackButton } from '@/components/ui'

const { t } = useI18n()

withDefaults(defineProps<{
  title: string
  subtitle?: string
  backTitle?: string
  infoTitle?: string
  infoActive?: boolean
}>(), {
  subtitle: '',
  infoActive: false
})

const emit = defineEmits<{
  back: []
  'toggle-info': []
}>()
</script>
