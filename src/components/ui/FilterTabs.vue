<template>
  <div class="filter-tabs" role="tablist" v-bind="$attrs">
    <button v-for="tab in tabs" :key="tab.value" type="button" class="filter-tab"
      :class="{ 'is-active': modelValue === tab.value }" @click="emit('update:modelValue', tab.value)">
      {{ tab.label }}
      <span v-if="showCount && tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface FilterTab {
  value: string
  label: string
  count?: number
}

withDefaults(defineProps<{
  tabs: FilterTab[]
  modelValue: string
  showCount?: boolean
}>(), {
  showCount: false
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<style lang="scss" scoped>
.filter-tabs {
    display: inline-flex;
    gap: 2px;
    margin-left: auto;
    padding: 2px;
    border-radius: var(--radius-sm);
    background: var(--surface-3);
}

.filter-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.22rem 0.5rem;
    border: 0;
    border-radius: 6px;
    font-size: 0.7rem;
    color: var(--text-3);
    background: transparent;
    cursor: pointer;
    transition: color 0.16s ease, background-color 0.16s ease;

    &:hover {
        color: var(--text);
    }

    &.is-active {
        color: var(--text);
        font-weight: 600;
        background: var(--surface-solid);
        box-shadow: var(--shadow-soft);
    }

    .tab-count {
        font-variant-numeric: tabular-nums;
        opacity: 0.75;
    }
}
</style>
