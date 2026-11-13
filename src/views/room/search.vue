<template>
  <div class="search-page">
    <button type="button" class="icon-btn back-btn page-back" title="返回房间列表" @click="goBack">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
        stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15.75 19.5 8.25 12l7.5-7.5" />
      </svg>
    </button>
    <header class="search-head">
      <h1 class="search-title">搜索房间</h1>
      <p class="search-sub">输入房间名后回车，可申请加入感兴趣的聊天室</p>

      <div class="ui-field search-field">
        <span class="ui-field-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
        </span>
        <input v-model.trim="roomName" type="text" placeholder="输入房间名" @keyup.enter="handleSearch" />
        <button type="button" class="btn btn-primary btn-sm" @click="handleSearch">搜索</button>
      </div>
    </header>

    <div class="search-body">
      <div v-if="result.length === 0" class="empty">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.8V20a1 1 0 0 0 1 1h4v-5a2 2 0 0 1 4 0v5h4a1 1 0 0 0 1-1V9.8" />
          </svg>
        </span>
        搜索结果会显示在这里
      </div>

      <div v-for="item in result" :key="item.id" class="result-card">
        <span class="avatar avatar-lg">{{ (item.name || '?').charAt(0).toUpperCase() }}</span>
        <div class="result-main">
          <div class="result-name">{{ item.name }}</div>
          <div class="result-desc">{{ item.description || '这个房间还没有描述' }}</div>
          <div class="result-meta">
            <span class="chip">群主 {{ item.user_info?.username || '—' }}</span>
          </div>
        </div>

        <button v-if="!roomStore.getRoomMap[item.id]" type="button" class="btn btn-primary btn-sm"
          @click="handleJoin(item.id)">
          申请加入
        </button>
        <span v-else class="chip chip-success">已加入</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useRoomStore } from "@/store/modules/room";
import ServerApi from "@/api";
import { Room } from "@/store/modules/room";
import { toast } from "@/components/ui/toast";

const router = useRouter()

/** 移动端搜索页是独立一屏，提供返回列表的入口 */
const goBack = () => router.push('/room/dashboard')
const roomName = ref("");

const result = ref<Room[]>([]);
const roomStore = useRoomStore();

const handleSearch = () => {
  if (!roomName.value) {
    toast.warning('请输入要搜索的房间名')
    return
  }
  ServerApi.SearchRoom(roomName.value).then((res: any) => {
    if (res.code === 200) {
      result.value = res.data;
      if (!res.data?.length) toast.info('没有找到匹配的房间')
    }
  });
};

const handleJoin = (room_id: string) => {
  ServerApi.apply({ room_id }).then((res: any) => {
    if (res.code === 200) {
      toast.success('已提交加入申请，等待群主同意')
      roomName.value = ''
      result.value = []
    }
  })
};
</script>

<style lang="scss" scoped>
.search-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

/* 移动端返回按钮（.back-btn 全局只在窄屏显示） */
.page-back {
  align-self: flex-start;
  margin: 0.55rem 0.75rem 0;
}

.search-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 2.2rem 1.25rem 1.5rem;
}

.search-title {
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text);
}

.search-sub {
  font-size: 0.75rem;
  color: var(--text-2);
  text-align: center;
}

.search-field {
  width: min(440px, 100%);
  margin-top: 0.9rem;
  box-shadow: var(--shadow-soft);
}

.search-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: min(440px, 100%);
  margin: 0 auto;
  padding: 0 1.25rem 2rem;
}

.result-card {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-2);
  transition: border-color 0.18s ease, background-color 0.18s ease;

  &:hover {
    border-color: var(--border-strong);
    background: var(--surface-3);
  }
}

.result-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.result-name {
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-desc {
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--text-2);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.result-meta {
  margin-top: 0.15rem;
}
</style>
