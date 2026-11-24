<template>
  <div class="empty" v-bind="$attrs">
    <span class="empty-icon">
      <slot name="icon">
        <AppIcon :name="icon" :size="20" :stroke-width="1.6" />
      </slot>
    </span>
    <slot>{{ text }}</slot>
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

type EmptyIcon = 'search' | 'users' | 'room' | 'house' | 'chat' | 'bell' | 'list' | 'plus' | 'group'

withDefaults(defineProps<{
  text?: string
  icon?: EmptyIcon
}>(), {
  icon: 'list'
})
</script>
