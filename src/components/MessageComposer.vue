<template>
  <div ref="inputAreaRef" class="composer">
    <div class="composer-box">
      <textarea :value="modelValue" placeholder="输入消息，回车发送（Shift + 回车换行）"
        @keydown.enter.exact.prevent="emit('send')"
        @input="onInput"></textarea>
      <div class="composer-actions">
        <slot name="actions" />
        <button type="button" class="icon-btn" title="发送图片" @click="emit('image')">
          <AppIcon name="image" :size="18" :stroke-width="1.6" />
        </button>
        <button type="button" class="icon-btn" title="发送文件" @click="emit('file')">
          <AppIcon name="file" :size="18" :stroke-width="1.6" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useResizable } from '@/hooks/resizable'

defineProps<{ modelValue: string }>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  image: []
  file: []
}>()

const inputAreaRef = ref<HTMLElement | null>(null)
useResizable(inputAreaRef, { direction: 'vertical', minSize: 150, maxSize: 600, initialSize: 180 })

/** 模板里不写 TS 断言（模板表达式按 JS 解析，as 会飘红），断言放到 script 内 */
const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>
