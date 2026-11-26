<template>
  <span class="avatar" :class="sizeClass" v-bind="$attrs">
    <slot>{{ initial }}</slot>
    <!-- 在线状态点：undefined 表示不展示（无在线语义的头像），布尔值区分在线/离线 -->
    <span v-if="online !== undefined" class="presence-dot" :class="{ 'is-online': online }"></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { avatarInitial } from '@/utils/format'

const props = withDefaults(defineProps<{
  name?: string | null
  size?: 'md' | 'lg' | 'xl'
  /** 在线状态；不传则不渲染状态点 */
  online?: boolean
}>(), {
  size: 'md',
  // 显式 undefined 覆盖 Vue 对 Boolean prop 的 false casting：未传时不渲染状态点
  online: undefined
})

const initial = computed(() => avatarInitial(props.name))
const sizeClass = computed(() => props.size === 'md' ? '' : `avatar-${props.size}`)
</script>
