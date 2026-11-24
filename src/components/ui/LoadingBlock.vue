<template>
  <div class="list-loading" v-bind="$attrs">
    <span class="loading-spinner"></span>
    <slot>{{ text }}</slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{ text?: string }>()
</script>
