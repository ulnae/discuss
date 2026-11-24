<template>
  <SidePanel v-model="roomName" :items="getRooms" :item-key="(item: any) => item.room_id" :active-id="paramsID"
    :has-detail="hasDetail" :loading="roomStore.loading && !roomStore.rooms.length" loading-text="正在加载房间…"
    :empty="getRooms.length === 0" empty-icon="chat" empty-text="还没有加入任何房间" search-placeholder="搜索房间"
    @select="handleRoomClick">
    <template #head-actions>
      <router-link to="/room/search" class="icon-btn" title="搜索并加入房间">
        <AppIcon name="room" :size="17" :stroke-width="1.6" />
      </router-link>
      <router-link to="/room/create" class="icon-btn" title="创建房间">
        <AppIcon name="plus" :size="17" :stroke-width="1.6" />
      </router-link>
    </template>
    <template #row="{ item }">
      <UserAvatar :name="item.room_info.name" />
      <span class="row-main">
        <span class="row-name">{{ item.room_info.name }}</span>
      </span>
      <span class="chip">
        {{ socketStore.roomMemberOnlineMap.get(item.room_id)?.size || 0 }}/{{
          socketStore.roomMemberMap.get(item.room_id)?.length || 0
        }}
      </span>
    </template>
    <template #body>
      <router-view></router-view>
    </template>
  </SidePanel>
</template>

<script setup lang="ts">
import { useRoomStore } from "@/store/modules/room";
import { useSocketStore } from "@/store/modules/socket";

import router from "@/router";
import { ref, computed, watchEffect } from "vue";
import { useRoute } from "vue-router";
import AppIcon from "@/components/ui/AppIcon.vue";
import UserAvatar from "@/components/ui/UserAvatar.vue";
import SidePanel from "@/components/SidePanel.vue";

const roomStore = useRoomStore();
const socketStore = useSocketStore();

const roomName = ref('')
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

