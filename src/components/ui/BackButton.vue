<template>
  <button type="button" class="icon-btn back-btn" v-bind="$attrs" @click="$emit('click')">
    <AppIcon name="back" :size="18" :stroke-width="1.8" />
  </button>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineEmits<{ click: [] }>()
</script>
