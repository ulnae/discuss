<template>
  <div class="apply-page">
    <!-- 待我审批：好友申请 + 入群申请统一展示 -->
    <section class="apply-col">
      <header class="apply-head">
        <span class="head-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          待我审批
        </span>
        <span class="chip chip-warning">{{ applyStore.pendingCount }}</span>

        <div class="filter-tabs" role="tablist" aria-label="待审批申请类型筛选">
          <button v-for="tab in filterTabs" :key="tab.value" type="button" class="filter-tab"
            :class="{ 'is-active': pendingFilter === tab.value }" @click="pendingFilter = tab.value">
            {{ tab.label }}
            <span class="tab-count">{{ tab.count(applyStore) }}</span>
          </button>
        </div>
      </header>

      <div class="apply-body">
        <div v-if="filteredPending.length > 0" class="apply-list">
          <div v-for="item in filteredPending" :key="item.id" class="apply-row">
            <span class="avatar" :class="{ 'avatar-room': isRoom(item) }">
              <svg v-if="isRoom(item)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01" />
              </svg>
              <template v-else>{{ (item.user_info?.username || '?').charAt(0).toUpperCase() }}</template>
            </span>

            <span class="row-main">
              <span class="row-title">
                <span class="type-badge" :class="isRoom(item) ? 'badge-room' : 'badge-friend'">
                  {{ isRoom(item) ? '入群申请' : '好友申请' }}
                </span>
                <span class="row-name">{{ item.user_info?.username }}</span>
              </span>
              <span class="row-sub">{{ describe(item) }}</span>
              <span class="row-times">
                <span class="time-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  <span class="time-label">申请</span>
                  <time class="time-value" :title="fullTime(item.createdAt)">{{ shortTime(item.createdAt) }}</time>
                </span>
                <span class="time-item" :class="{ 'is-pending': !item.handle_status }">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  <span class="time-label">处理</span>
                  <time v-if="item.handle_status" class="time-value" :title="fullTime(item.updatedAt)">
                    {{ shortTime(item.updatedAt) }}
                  </time>
                  <span v-else class="time-value time-wait">待处理</span>
                </span>
              </span>
            </span>

            <span v-if="item.handle_status" class="chip"
              :class="item.status ? 'chip-success' : 'chip-danger'">
              {{ item.status ? '已同意' : '已拒绝' }}
            </span>
            <span v-else class="row-actions">
              <button type="button" class="icon-btn approve" title="同意" @click="applyStore.handleApply(item.id, true)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
                  stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </button>
              <button type="button" class="icon-btn reject" title="拒绝" @click="applyStore.handleApply(item.id, false)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
                  stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
        </div>

        <div v-else class="empty">
          <span class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M4 6.5h16M4 12h16M4 17.5h10" />
            </svg>
          </span>
          {{ pendingFilter === 'all' ? '暂无待处理申请' : `暂无${pendingFilter === 'friend' ? '好友' : '入群'}申请` }}
        </div>
      </div>
    </section>

    <!-- 我发起的申请 -->
    <section class="apply-col">
      <header class="apply-head">
        <span class="head-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
          </svg>
          我发起的申请
        </span>
        <span class="chip">{{ applyStore.applies.length }}</span>

        <div class="filter-tabs" role="tablist" aria-label="我发起的申请类型筛选">
          <button v-for="tab in filterTabs" :key="tab.value" type="button" class="filter-tab"
            :class="{ 'is-active': sentFilter === tab.value }" @click="sentFilter = tab.value">
            {{ tab.label }}
          </button>
        </div>
      </header>

      <div class="apply-body">
        <div v-if="filteredSent.length > 0" class="apply-list">
          <div v-for="item in filteredSent" :key="item.id" class="apply-row">
            <span class="avatar" :class="{ 'avatar-room': isRoom(item) }">
              <svg v-if="isRoom(item)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01" />
              </svg>
              <template v-else>+</template>
            </span>
            <span class="row-main">
              <span class="row-title">
                <span class="type-badge" :class="isRoom(item) ? 'badge-room' : 'badge-friend'">
                  {{ isRoom(item) ? '入群申请' : '好友申请' }}
                </span>
                <span class="row-name">{{ sentTarget(item) }}</span>
              </span>
              <span class="row-sub">{{ item.handle_status ? '对方已处理' : '等待对方处理' }}</span>
              <span class="row-times">
                <span class="time-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  <span class="time-label">申请</span>
                  <time class="time-value" :title="fullTime(item.createdAt)">{{ shortTime(item.createdAt) }}</time>
                </span>
                <span class="time-item" :class="{ 'is-pending': !item.handle_status }">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  <span class="time-label">处理</span>
                  <time v-if="item.handle_status" class="time-value" :title="fullTime(item.updatedAt)">
                    {{ shortTime(item.updatedAt) }}
                  </time>
                  <span v-else class="time-value time-wait">待处理</span>
                </span>
              </span>
            </span>

            <span v-if="item.handle_status" class="chip" :class="item.status ? 'chip-success' : 'chip-danger'">
              {{ item.status ? '已同意' : '已拒绝' }}
            </span>
            <span v-else class="chip chip-warning">待处理</span>
          </div>
        </div>

        <div v-else class="empty">
          <span class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
          还没有发起过申请
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useApplyStore, type Apply } from "@/store/modules/apply";
import dayjs from "@/plugin/dayjs";

const applyStore = useApplyStore();
applyStore.getPendingApplies();
applyStore.getApplies();

type FilterValue = 'all' | 'friend' | 'room';
const pendingFilter = ref<FilterValue>('all');
const sentFilter = ref<FilterValue>('all');

const filterTabs = [
    { value: 'all' as FilterValue, label: '全部', count: (s: typeof applyStore) => s.pendingCount },
    { value: 'friend' as FilterValue, label: '好友', count: (s: typeof applyStore) => s.pendingFriendApplies.filter(a => !a.handle_status).length },
    { value: 'room' as FilterValue, label: '入群', count: (s: typeof applyStore) => s.pendingRoomApplies.filter(a => !a.handle_status).length },
];

const isRoom = (item: Apply) => !!item.room_id;
const match = (item: Apply, filter: FilterValue) =>
    filter === 'all' || (filter === 'room' ? !!item.room_id : !item.room_id);

const filteredPending = computed(() => applyStore.pendingApplies.filter(a => match(a, pendingFilter.value)));
const filteredSent = computed(() => applyStore.applies.filter(a => match(a, sentFilter.value)));

/** 待审批列表的描述：区分「申请加为好友」和「申请加入房间」 */
const describe = (item: Apply) => isRoom(item)
    ? `申请加入「${item.room_info?.name || '房间'}」`
    : '申请加为好友';

/** 我发起的列表目标：入群显示房间名，好友显示被申请人 */
const sentTarget = (item: Apply) => isRoom(item)
    ? item.room_info?.name || '房间'
    : item.apply_user_info?.username || '用户';

/** 列表里的紧凑时间：月/日 时:分，无值显示占位 */
const shortTime = (ts?: string) => (ts ? dayjs(ts).format('MM/DD HH:mm') : '—')
/** 悬停提示里的完整时间 */
const fullTime = (ts?: string) => (ts ? dayjs(ts).format('YYYY/MM/DD HH:mm:ss') : '')
</script>

<style lang="scss" scoped>
.apply-page {
    display: flex;
    gap: 10px;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 10px;
}

.apply-col {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    overflow: hidden;
}

.apply-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text);
    border-bottom: 1px solid var(--border);

    .head-title {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        white-space: nowrap;

        svg {
            width: 15px;
            height: 15px;
            color: var(--text-2);
        }
    }
}

.filter-tabs {
    display: inline-flex;
    gap: 2px;
    margin-left: auto;
    padding: 2px;
    border-radius: 8px;
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

.apply-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}

.apply-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0.4rem;
}

.apply-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem;
    border-radius: 10px;
    transition: background-color 0.16s ease;

    &:hover {
        background: var(--surface-3);

        .approve,
        .reject {
            opacity: 1;
        }
    }
}

.row-actions {
    display: inline-flex;
    gap: 0.3rem;
    flex-shrink: 0;
}

.row-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
}

.type-badge {
    flex-shrink: 0;
    padding: 0.08rem 0.4rem;
    border-radius: 999px;
    font-size: 0.62rem;
    font-weight: 600;
    line-height: 1.4;

    &.badge-friend {
        color: var(--success-fg);
        background: var(--success-soft);
    }

    &.badge-room {
        color: var(--info);
        background: var(--toast-info-soft);
    }
}

/* 时间信息：申请时间 + 处理时间，与名称左对齐成一行 */
.row-times {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.75rem;
    margin-top: 0.2rem;
    font-size: 0.68rem;
    line-height: 1.2;
}

.time-item {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    white-space: nowrap;

    svg {
        width: 11px;
        height: 11px;
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

/* 未处理时「处理」项用中性色，避免与已处理时间混淆 */
.time-item.is-pending {
    .time-value.time-wait {
        color: var(--warning-fg);
    }
}

.approve,
.reject {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    opacity: 0.55;
    transition: opacity 0.16s ease, color 0.16s ease, background-color 0.16s ease;

    svg {
        width: 14px;
        height: 14px;
    }
}

.approve:hover {
    color: var(--success-fg);
    background: var(--success-soft);
}

.reject:hover {
    color: var(--danger);
    background: var(--danger-soft);
}

.apply-row .avatar {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    font-size: 0.72rem;
    flex-shrink: 0;

    &.avatar-room {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        svg {
            width: 16px;
            height: 16px;
        }
    }
}

.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    min-height: 120px;
    color: var(--text-3);
    font-size: 0.76rem;

    .empty-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        color: var(--text-3);
        background: var(--surface-3);

        svg {
            width: 20px;
            height: 20px;
        }
    }
}

@media (max-width: 760px) {
    .apply-page {
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        overflow-y: auto;
    }

    /* 单列时不再各自内部滚动，整页滚更符合手机习惯 */
    .apply-col {
        flex: 0 0 auto;
    }

    .apply-body {
        overflow: visible;
    }

    /* 触摸设备没有 hover，操作按钮常显并放大热区 */
    .approve,
    .reject {
        width: 32px;
        height: 32px;
        opacity: 1;
    }
}
</style>
