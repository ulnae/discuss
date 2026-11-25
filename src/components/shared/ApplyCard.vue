<template>
  <article class="apply-card" :class="{ 'is-done': item.handle_status }">
    <div class="card-top">
      <span class="avatar apply-avatar">
        <AppIcon v-if="isRoom" name="group" :size="19" :stroke-width="1.7" />
        <template v-else>{{ avatarInitial(avatarName) }}</template>
      </span>

      <div class="card-identity">
        <div class="identity-line">
          <span class="row-name">{{ title }}</span>
          <span class="chip type-badge" :class="isRoom ? 'badge-room' : 'badge-friend'">
            {{ isRoom ? '入群申请' : '好友申请' }}
          </span>
        </div>
        <p class="card-reason">{{ reason }}</p>
      </div>

      <span v-if="item.handle_status" class="status-flag" :class="item.status ? 'flag-success' : 'flag-danger'">
        {{ item.status ? '已同意' : '已拒绝' }}
      </span>
      <span v-else class="status-flag flag-wait">待处理</span>
    </div>

    <div class="card-foot">
      <div class="card-times">
        <span class="time-item">
          <AppIcon name="clock" :size="12" :stroke-width="1.8" />
          <span class="time-label">申请</span>
          <time class="time-value" :title="formatFullTime(item.createdAt)">{{ formatShortTime(item.createdAt) }}</time>
        </span>
        <span class="time-item" :class="{ 'is-pending': !item.handle_status }">
          <AppIcon name="clock" :size="12" :stroke-width="1.8" />
          <span class="time-label">处理</span>
          <time v-if="item.handle_status" class="time-value" :title="formatFullTime(item.updatedAt)">
            {{ formatShortTime(item.updatedAt) }}
          </time>
          <span v-else class="time-value time-wait">待处理</span>
        </span>
      </div>

      <div v-if="mode === 'pending' && !item.handle_status" class="card-actions">
        <button type="button" class="btn btn-sm reject" @click="emit('reject', item.id)">拒绝</button>
        <button type="button" class="btn btn-sm approve" @click="emit('approve', item.id)">同意</button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AppIcon } from '@/components/ui'

import { avatarInitial, formatShortTime, formatFullTime } from '@/utils/format'
import type { Apply } from '@/store/modules/apply'

const props = withDefaults(defineProps<{
  item: Apply
  title: string
  reason: string
  avatarName?: string
  mode?: 'pending' | 'sent'
}>(), {
  mode: 'pending'
})

const emit = defineEmits<{
  approve: [id: string]
  reject: [id: string]
}>()

const isRoom = computed(() => !!props.item.room_id)
</script>

<style lang="scss" scoped>
.apply-card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.7rem 0.75rem;
    border-radius: var(--radius-md);
    background: var(--surface-solid);

    &.is-done {
        opacity: 0.66;
    }
}

.card-top {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
}

.card-identity {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.identity-line {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
}

.card-reason {
    margin: 0;
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--text-2);
}

.type-badge {
    flex-shrink: 0;
    font-size: 0.62rem;
    font-weight: 600;
}

.badge-friend {
    color: var(--text-2);
    background: var(--surface-3);
}

.badge-room {
    color: var(--accent-fg);
    background: var(--accent);
}

.status-flag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    font-size: 0.68rem;
    font-weight: 500;
    white-space: nowrap;

    &::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
    }
}

.flag-wait {
    color: var(--warning-fg);
}

.flag-success {
    color: var(--success-fg);
}

.flag-danger {
    color: var(--danger);
}

.card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-top: 0.55rem;
    border-top: 1px solid var(--border);
}

.card-times {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.85rem;
    min-width: 0;
    font-size: 0.68rem;
    line-height: 1.2;
}

.time-item {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    white-space: nowrap;

    svg {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
        color: var(--text-3);
    }
}

.time-label {
    color: var(--text-3);
}

.time-value {
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
}

.time-item.is-pending .time-value.time-wait {
    color: var(--warning-fg);
}

.card-actions {
    display: inline-flex;
    gap: 0.4rem;
    flex-shrink: 0;
}

.approve {
    color: var(--accent-fg);
    background: var(--accent);

    &:hover {
        background: var(--accent-hover);
    }
}

.reject {
    color: var(--text-2);
    background: var(--surface-2);

    &:hover {
        color: var(--danger);
        background: var(--danger-soft);
    }
}

.apply-avatar {
    color: var(--accent-fg);
    background: var(--accent);

    svg {
        width: 19px;
        height: 19px;
    }
}
</style>
