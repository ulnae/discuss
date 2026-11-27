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
          {{ t('apply.pendingHeader') }}
        </span>
        <span class="count-badge" :class="{ 'is-emphasis': applyStore.pendingCount > 0 }">{{ applyStore.pendingLoading ? '…' : applyStore.pendingCount }}</span>

        <FilterTabs :tabs="filterTabs" :model-value="pendingFilter" :show-count="true"
          :aria-label="t('apply.pendingFilterAria')"
          @update:model-value="onPendingFilter" />
      </header>

      <div class="apply-body">
        <LoadingBlock v-if="applyStore.pendingLoading" :text="t('apply.loadingPending')" />
        <template v-else>
          <div v-if="filteredPending.length > 0" class="apply-list">
            <ApplyCard v-for="item in filteredPending" :key="item.id" :item="item" mode="pending"
              :title="item.user_info?.username || t('apply.defaultUser')" :reason="describe(item)"
              :avatar-name="item.user_info?.username"
              @approve="id => applyStore.handleApply(id, true)"
              @reject="id => applyStore.handleApply(id, false)" />
          </div>

          <EmptyState v-else icon="list"
            :text="pendingFilter === 'all' ? t('apply.emptyPendingAll') : pendingFilter === 'friend' ? t('apply.emptyPendingFriend') : t('apply.emptyPendingRoom')" />
        </template>
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
          {{ t('apply.sentHeader') }}
        </span>
        <span class="count-badge">{{ applyStore.sentLoading ? '…' : applyStore.applies.length }}</span>

        <FilterTabs :tabs="filterTabs" :model-value="sentFilter" :aria-label="t('apply.sentFilterAria')"
          @update:model-value="onSentFilter" />
      </header>

      <div class="apply-body">
        <LoadingBlock v-if="applyStore.sentLoading" :text="t('apply.loadingSent')" />
        <template v-else>
          <div v-if="filteredSent.length > 0" class="apply-list">
            <ApplyCard v-for="item in filteredSent" :key="item.id" :item="item" mode="sent"
              :title="sentTarget(item)" :reason="sentDescribe(item)" :avatar-name="friendName(item)" />
          </div>

          <EmptyState v-else icon="plus" :text="t('apply.emptySent')" />
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from 'vue-i18n'
import { useApplyStore, type Apply } from "@/store/modules/apply";
import { ApplyCard } from '@/components'

import { FilterTabs, LoadingBlock, EmptyState } from '@/components/ui'




const applyStore = useApplyStore();
const { t } = useI18n();
// 两栏数据已纳入 userStore.getInfo() 全局启动链路（刷新 / 登录都会拉取），
// 这里不再重复请求；socket 事件的增量刷新由 store 内部以 silent 方式处理。

type FilterValue = 'all' | 'friend' | 'room';
const pendingFilter = ref<FilterValue>('all');
const sentFilter = ref<FilterValue>('all');

/** 模板里不写 TS 断言（模板表达式按 JS 解析，as 会飘红），断言放到 script 内 */
const onPendingFilter = (value: string) => { pendingFilter.value = value as FilterValue };
const onSentFilter = (value: string) => { sentFilter.value = value as FilterValue };

const filterTabs = computed(() => [
    { value: 'all' as FilterValue, label: t('apply.filterAll'), count: applyStore.pendingCount },
    { value: 'friend' as FilterValue, label: t('apply.filterFriend'), count: applyStore.pendingFriendApplies.filter(a => !a.handle_status).length },
    { value: 'room' as FilterValue, label: t('apply.filterRoom'), count: applyStore.pendingRoomApplies.filter(a => !a.handle_status).length },
]);

const isRoom = (item: Apply) => !!item.room_id;
const match = (item: Apply, filter: FilterValue) =>
    filter === 'all' || (filter === 'room' ? !!item.room_id : !item.room_id);

const filteredPending = computed(() => applyStore.pendingApplies.filter(a => match(a, pendingFilter.value)));
const filteredSent = computed(() => applyStore.applies.filter(a => match(a, sentFilter.value)));

/** 待审批列表的描述：区分「申请加为好友」和「申请加入房间」 */
const describe = (item: Apply) => isRoom(item)
    ? t('apply.joinRoom', { room: item.room_info?.name || t('apply.defaultRoom') })
    : t('apply.addFriend');

/** 我发起的列表目标：入群显示房间名，好友显示被申请人 */
const sentTarget = (item: Apply) => isRoom(item)
    ? item.room_info?.name || t('apply.defaultRoom')
    : item.apply_user_info?.username || t('apply.defaultUser');

/** 我发起的列表事由：与顶部「目标」配合，说明申请类型 */
const sentDescribe = (item: Apply) => isRoom(item) ? t('apply.sentRoomDesc') : t('apply.sentFriendDesc');

/** 我发起的·好友申请里「对方」的名字（与待我审批取申请人的视角一致） */
const friendName = (item: Apply) => item.apply_user_info?.username || t('apply.defaultUser');
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

/* 头部计数徽章：圆形紧凑，有待办用主色实心强调，为 0 时弱化 */
.count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.15rem;
    height: 1.15rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--text-3);
    font-size: 0.64rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;

    &.is-emphasis {
        background: var(--accent);
        color: var(--accent-fg);
    }
}

/* loading / 空状态占满剩余高度，视觉节奏一致 */
.apply-body > .list-loading {
    flex: 1;
}

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
