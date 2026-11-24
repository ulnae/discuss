<template>
  <span class="avatar" :class="sizeClass" v-bind="$attrs">
    <slot>{{ initial }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { avatarInitial } from '@/utils/format'

const props = withDefaults(defineProps<{
  name?: string | null
  size?: 'md' | 'lg' | 'xl'
}>(), {
  size: 'md'
})

const initial = computed(() => avatarInitial(props.name))
const sizeClass = computed(() => props.size === 'md' ? '' : `avatar-${props.size}`)
</script>
