<template>
  <div class="apply-page">
    <section class="apply-col">
      <header class="apply-head">
        <span>待处理申请</span>
        <span class="chip">{{ applyStore.pendingApplies.length }}</span>
      </header>

      <div class="apply-body">
        <div v-if="applyStore.pendingApplies.length > 0" class="apply-list">
          <div v-for="item in applyStore.pendingApplies" :key="item.id" class="apply-row">
            <span class="avatar">{{ (item.user_info?.username || '?').charAt(0).toUpperCase() }}</span>
            <span class="row-main">
              <span class="row-name">{{ item.user_info?.username }}</span>
              <span class="row-sub">申请加为好友</span>
            </span>

            <template v-if="!item.handle_status">
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
            </template>
            <span v-else class="chip" :class="item.status ? 'chip-success' : 'chip-danger'">
              {{ item.status ? '已同意' : '已拒绝' }}
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
          暂无待处理申请
        </div>
      </div>
    </section>

    <section class="apply-col">
      <header class="apply-head">
        <span>我发起的申请</span>
        <span class="chip">{{ applyStore.applies.length }}</span>
      </header>

      <div class="apply-body">
        <div v-if="applyStore.applies.length > 0" class="apply-list">
          <div v-for="item in applyStore.applies" :key="item.id" class="apply-row">
            <span class="avatar">+</span>
            <span class="row-main">
              <span class="row-name" v-if="item.room_id">加入房间 {{ item.room_info?.name }}</span>
              <span class="row-name" v-else>添加好友 {{ item.apply_user_info?.username }}</span>
              <span class="row-sub">
                {{ item.handle_status ? '对方已处理' : '等待对方处理' }}
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
import { useApplyStore } from "@/store/modules/apply";

const applyStore = useApplyStore();
applyStore.getPendingApplies()
applyStore.getApplies()
</script>

<style lang="scss" scoped>
.apply-page {
    display: flex;
    gap: 10px;
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
    padding: 0.7rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text);
    border-bottom: 1px solid var(--border);
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
    padding: 0.45rem 0.5rem;
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
    background: rgba(16, 185, 129, 0.12);
}

.reject:hover {
    color: var(--danger);
    background: rgba(225, 29, 72, 0.1);
}

.apply-row .avatar {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    font-size: 0.72rem;
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
