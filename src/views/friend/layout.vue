<!--
 * @Author       : Eug yyh3531@163.com
 * @Date         : 2025-11-23 20:37:33
 * @LastEditors  : Eug yyh3531@163.com
 * @LastEditTime : 2025-11-23 21:15:50
 * @FilePath     : \e-talk\src\views\friend\layout.vue
 * @Description  : filename
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
-->
<template lang="">
  <div class="w-full h-full flex">
      <div ref="sidebarRef" class="w-[240px] border-r border-gray-300 animate__fadeIn animate__animated flex flex-col">
        <div class="flex justify-center items-center gap-2 p-2 text-xs border-b border-gray-300">

            <input type="text" placeholder="输入用户名" v-model="username" class="w-full rounded-md px-2 h-8 focus:outline-none flex justify-center items-center"/>

            <router-link to="/friend/search">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
            </router-link>

        </div>
        <div class="flex-1 overflow-y-auto flex flex-col gap-1 p-1">
          <div 
          v-for="friend in getFriends" 
          @click="handleFriendClick(friend)" 
          :key="friend.id"
          class="cursor-pointer p-2 hover:bg-gray-200 truncate animate__flipInX animate__animated flex items-center rounded-md" 
          :class="{
            'bg-gray-200': paramsID === friend.friend_info.id, 
            'text-green-700': friendStore.getFriendMap[friend.friend_info.id]?.status
          }">
          {{ friend.friend_info.username }}
        </div>
        </div>
      </div>
      <div class="w-0 flex-auto animate__fadeIn animate__animated">
          <router-view></router-view>
      </div>
  </div>
</template>
<script setup lang="ts">
import { useFriendStore } from "@/store/modules/friend";
import router from "@/router";
import { useRoute } from "vue-router";
import { ref, computed, watchEffect } from "vue";
import { useResizable } from "@/hooks/useResizable";

const friendStore = useFriendStore();
const username = ref('')
const sidebarRef = ref<HTMLElement | null>(null);
useResizable(sidebarRef, { direction: 'horizontal', minSize: 180, maxSize: 480, initialSize: 240 });
const getFriends = computed(() => {
  return friendStore.friends.filter((friend: any) => friend.friend_info.username.includes(username.value))
})

const route = useRoute()
const paramsID = ref<string | undefined>(undefined)

watchEffect(() => {
  paramsID.value = route.params?.id as string
})

const handleFriendClick = (friend: any) => {
  router.push({
    name: "friend-info",
    params: {
      id: friend.friend_info.id,
    },
  });
};
</script>
<style lang="">
</style>