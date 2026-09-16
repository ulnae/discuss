<template lang="">
  <div class="w-full h-full flex">
      <div ref="sidebarRef" class="w-[240px] border-r border-gray-300 animate__fadeIn animate__animated flex flex-col">
        <div class="flex justify-center items-center gap-2 p-2 text-xs border-b border-gray-300">

            <input type="text" placeholder="输入房间名" v-model="roomName" class="w-full rounded-md px-2 h-8 flex justify-center items-center focus:outline-none"/>

            <router-link to="/room/search">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
            </router-link>

            <router-link to="/room/create">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
            </router-link>

        </div>
        <div class="flex-1 overflow-y-auto flex flex-col gap-1 p-1">
          <div v-for="room in getRooms" @click="handleRoomClick(room)" :key="room.id"
              class="cursor-pointer p-2 hover:bg-gray-200 flex gap-2 items-center rounded-md" :class="{'bg-gray-200': paramsID === room.room_id}">
              <div class="w-[0px] flex-2 truncate animate__flipInX animate__animated">{{ room.room_info.name }}</div>
              <div class="w-[0px] flex-1 text-gray-500 text-xs text-right self-end">{{socketStore.roomMemberOnlineMap.get(room.room_id)?.size}}/{{socketStore.roomMemberMap.get(room.room_id)?.length}}</div>
            </div>
        </div>
      </div>
      <div class="w-0 flex-auto animate__fadeIn animate__animated">
          <router-view></router-view>
      </div>
  </div>
</template>
<script setup lang="ts">
import { useRoomStore } from "@/store/modules/room";
import { useSocketStore } from "@/store/modules/socket";

import router from "@/router";
import { ref, computed, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { useResizable } from "@/hooks/useResizable";
// https://heroicons.com/
// 引入 heroicons 图标

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

const handleRoomClick = (room: any) => {
  router.push({
    name: "room-message",
    params: {
      id: room.room_id,
    },
  });
};
</script>
<style lang="">
</style>