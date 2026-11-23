<template>
  <div class="apply-page">
    <!-- 待我审批：好友申请 + 入群申请统一展示 -->
    <section class="apply-col panel-soft">
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
          <article v-for="item in filteredPending" :key="item.id" class="apply-card"
            :class="{ 'is-done': item.handle_status }">
            <!-- 主信息：头像 + 身份 + 申请事由 -->
            <div class="card-top">
              <span class="avatar" :class="{ 'avatar-room': isRoom(item) }">
                <svg v-if="isRoom(item)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01" />
                </svg>
                <template v-else>{{ (item.user_info?.username || '?').charAt(0).toUpperCase() }}</template>
              </span>

              <div class="card-identity">
                <div class="identity-line">
                  <span class="row-name">{{ item.user_info?.username }}</span>
                  <span class="chip type-badge">{{ isRoom(item) ? '入群申请' : '好友申请' }}</span>
                </div>
                <p class="card-reason">{{ describe(item) }}</p>
              </div>

              <span v-if="item.handle_status" class="status-flag"
                :class="item.status ? 'flag-success' : 'flag-danger'">
                {{ item.status ? '已同意' : '已拒绝' }}
              </span>
              <span v-else class="status-flag flag-wait">待处理</span>
            </div>

            <!-- 底部：时间线 + 审批操作 -->
            <div class="card-foot">
              <div class="card-times">
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
              </div>

              <div v-if="!item.handle_status" class="card-actions">
                <button type="button" class="btn btn-sm reject" @click="applyStore.handleApply(item.id, false)">拒绝</button>
                <button type="button" class="btn btn-sm approve" @click="applyStore.handleApply(item.id, true)">同意</button>
              </div>
            </div>
          </article>
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
    <section class="apply-col panel-soft">
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
          <article v-for="item in filteredSent" :key="item.id" class="apply-card"
            :class="{ 'is-done': item.handle_status }">
            <div class="card-top">
              <span class="avatar" :class="{ 'avatar-room': isRoom(item) }">
                <svg v-if="isRoom(item)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01" />
                </svg>
                <template v-else>+</template>
              </span>

              <div class="card-identity">
                <div class="identity-line">
                  <span class="row-name">{{ sentTarget(item) }}</span>
                  <span class="chip type-badge">{{ isRoom(item) ? '入群申请' : '好友申请' }}</span>
                </div>
                <p class="card-reason">{{ sentDescribe(item) }}</p>
              </div>

              <span v-if="item.handle_status" class="status-flag"
                :class="item.status ? 'flag-success' : 'flag-danger'">
                {{ item.status ? '已同意' : '已拒绝' }}
              </span>
              <span v-else class="status-flag flag-wait">待处理</span>
            </div>

            <div class="card-foot">
              <div class="card-times">
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
              </div>
            </div>
          </article>
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

/** 我发起的列表事由：与顶部「目标」配合，说明申请类型 */
const sentDescribe = (item: Apply) => isRoom(item) ? '申请加入该群' : '申请添加好友';

/** 列表里的紧凑时间：月/日 时:分，无值显示占位 */
const shortTime = (ts?: string) => (ts ? dayjs(ts).format('MM/DD HH:mm') : '—')
/** 悬停提示里的完整时间 */
const fullTime = (ts?: string) => (ts ? dayjs(ts).format('YYYY/MM/DD HH:mm:ss') : '')
</script>

<style lang="scss" scoped>
/* 申请页特有布局：两栏并排。卡片/列表/头像/徽章/按钮/空状态全部复用设计系统通用类，
   这里只写通用类覆盖不到的局部规则（筛选 tab、类型徽章、时间行、语义色、空状态占高）。 */
.apply-page {
    display: flex;
    gap: 10px;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 10px;
}

/* .panel-soft 提供玻璃表面/边框/圆角，这里只管两栏的 flex 布局 */
.apply-col {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}

/* 头部节奏对齐全局 .side-head */
.apply-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.62rem 0.7rem;
    border-bottom: 1px solid var(--border);

    .head-title {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.78rem;
        font-weight: 500;
        color: var(--text);
        white-space: nowrap;

        svg {
            width: 15px;
            height: 15px;
            color: var(--text-2);
        }
    }
}

/* 分段筛选：surface 层级与 .ui-field 聚焦态一致（surface-3 底 + surface-solid 激活） */
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

/* 滚动区节奏对齐全局 .side-list */
.apply-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
    overflow-y: auto;
    padding: 0.45rem;
}

.apply-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

/* 卡片式申请项：上=身份与事由，下=时间线与操作，两栏用细分割线区隔。
   待我审批 / 我发起的共用同一套结构，只在底部操作区有差异。 */
.apply-card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.7rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-solid);
    box-shadow: var(--shadow-soft);
    transition: border-color 0.16s ease, box-shadow 0.16s ease;

    &:hover {
        border-color: var(--border-strong, var(--border));
    }

    /* 已处理的申请弱化显示，视觉上让位于待处理项 */
    &.is-done {
        opacity: 0.66;

        &:hover {
            opacity: 1;
        }
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

/* 申请事由：单独一行强调“要做什么”，比旧版塞进副标题更醒目 */
.card-reason {
    margin: 0;
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--text-2);
}

/* 类型徽章：统一 info 蓝底，与右侧状态色（绿/红/黄）区分开 */
.type-badge {
    flex-shrink: 0;
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--info);
    background: var(--toast-info-soft);
}

/* 状态标记：待处理=黄、已同意=绿、已拒绝=红；圆点 + 文案 */
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

/* 底部：时间线（左）+ 操作按钮（右），细分割线与主体隔开 */
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

/* 未处理时「处理」项用警示色，避免与已处理时间混淆 */
.time-item.is-pending .time-value.time-wait {
    color: var(--warning-fg);
}

.card-actions {
    display: inline-flex;
    gap: 0.4rem;
    flex-shrink: 0;
}

/* 审批按钮：同意=主色实心（主操作），拒绝=低调描边，hover 才显危险红 */
.apply-card {
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
}

/* 房间头像用图标，居中由全局 .avatar 的 grid 完成，这里只定图标尺寸 */
.avatar-room svg {
    width: 17px;
    height: 17px;
}

/* 空状态复用 .empty / .empty-icon，这里让它占满剩余高度 */
.empty {
    flex: 1;
    min-height: 120px;
}

@media (max-width: 768px) {
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
}
</style>
