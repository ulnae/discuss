<template>
  <div class="side-shell" :class="{ 'has-detail': hasDetail }">
    <aside ref="sidebarRef" class="side">
      <div class="side-head">
        <div class="ui-field ui-field-sm">
          <span class="ui-field-icon">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
          </span>
          <input v-model="roomName" type="text" placeholder="搜索房间" />
        </div>

        <router-link to="/room/search" class="icon-btn" title="搜索并加入房间">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21 21-5.2-5.2m0 0A7.5 7.5 0 1 0 5.2 5.2a7.5 7.5 0 0 0 10.6 10.6Z" />
          </svg>
        </router-link>

        <router-link to="/room/create" class="icon-btn" title="创建房间">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </router-link>
      </div>

      <div class="side-list">
        <button v-for="room in getRooms" :key="room.id" type="button" class="list-row"
          :class="{ 'is-active': paramsID === room.room_id }" @click="handleRoomClick(room)">
          <span class="avatar">{{ (room.room_info.name || '?').charAt(0).toUpperCase() }}</span>
          <span class="row-main">
            <span class="row-name">{{ room.room_info.name }}</span>
            <span class="row-sub">
              {{ socketStore.roomMemberOnlineMap.get(room.room_id)?.size || 0 }} 人在线
            </span>
          </span>
          <span class="chip">
            {{ socketStore.roomMemberOnlineMap.get(room.room_id)?.size || 0 }}/{{ socketStore.roomMemberMap.get(room.room_id)?.length || 0 }}
          </span>
        </button>

        <div v-if="getRooms.length === 0" class="empty">
          <span class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M20.25 8.5c.9.3 1.5 1.1 1.5 2.1v4.3c0 1.1-.8 2.1-2 2.2l-1 .1v3l-3-3c-1.4 0-2.7-.1-4-.2" />
              <path d="M16.5 6.6c0-1.6-1.2-3-2.8-3.2A48 48 0 0 0 5 3.4C3.4 3.6 2.2 5 2.2 6.6v6.2c0 1.6 1.2 3 2.8 3.2L7 16.2V21l4.2-4.2" />
            </svg>
          </span>
          还没有加入任何房间
        </div>
      </div>
    </aside>

    <section class="side-body">
      <router-view></router-view>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRoomStore } from "@/store/modules/room";
import { useSocketStore } from "@/store/modules/socket";

import router from "@/router";
import { ref, computed, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { useResizable } from "@/hooks/resizable";

const roomStore = useRoomStore();
const socketStore = useSocketStore();

const roomName = ref('')
const sidebarRef = ref<HTMLElement | null>(null);
useResizable(sidebarRef, { direction: 'horizontal', minSize: 180, maxSize: 480, initialSize: 240 });
const getRooms = computed(() => {
  return roomStore.rooms.filter((room: any) => room.room_info.name.includes(roomName.value))
})

const route = useRoute()
const paramsID = ref<string | undefined>(undefined)

watchEffect(() => {
  paramsID.value = route.params?.id as string
})

/** 移动端是否有详情视图：搜索 / 创建房间 / 聊天页都算，只有欢迎页不算
 *  （原来只看 params.id，导致 /room/search、/room/create 在窄屏下内容区不可见） */
const hasDetail = computed(() => !!route.name && route.name !== 'room-dashboard')

const handleRoomClick = (room: any) => {
  router.push({
    name: "room-message",
    params: {
      id: room.room_id,
    },
  });
};
</script>

<style lang="scss" scoped>
.side-head {
    .ui-field {
        flex: 1;
        min-width: 0;
    }
}

.list-row .chip {
    font-variant-numeric: tabular-nums;
}

/* 移动端：房间列表和聊天分两屏 */
@media (max-width: 768px) {
    .side-shell {
        position: relative;
    }

    .side {
        width: 100% !important;
        border-right: 0;
    }

    .side-body {
        display: none;
    }

    .side-shell.has-detail .side {
        display: none;
    }

    .side-shell.has-detail .side-body {
        display: flex;
    }
}
</style>
