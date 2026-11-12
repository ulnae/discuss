<template>
  <div class="side-shell">
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
          <input v-model="username" type="text" placeholder="搜索好友" />
        </div>

        <router-link to="/friend/search" class="icon-btn" title="添加好友">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </router-link>
      </div>

      <div class="side-list">
        <button v-for="friend in getFriends" :key="friend.id" type="button" class="list-row"
          :class="{ 'is-active': paramsID === friend.friend_info.id }" @click="handleFriendClick(friend)">
          <span class="avatar">{{ initial(friend.friend_info.username) }}</span>
          <span class="row-main">
            <span class="row-name">{{ friend.friend_info.username }}</span>
            <span class="row-sub">{{ isOnline(friend.friend_info.id) ? '在线' : '离线' }}</span>
          </span>
          <span class="dot" :class="{ 'dot-online': isOnline(friend.friend_info.id) }"></span>
        </button>

        <div v-if="getFriends.length === 0" class="empty">
          <span class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M18 18.7a9.1 9.1 0 0 0 3.7-.5 3 3 0 0 0-4.7-2.7m.9 3.2v.1c0 .2 0 .4-.1.6A12 12 0 0 1 12 21a12 12 0 0 1-6-1.6V19a6 6 0 0 1 6-6 6 6 0 0 1 6 6Z" />
              <circle cx="12" cy="7" r="3.4" />
            </svg>
          </span>
          还没有好友，点右上角 + 搜索添加
        </div>
      </div>
    </aside>

    <section class="side-body">
      <router-view></router-view>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useFriendStore } from "@/store/modules/friend";
import router from "@/router";
import { useRoute } from "vue-router";
import { ref, computed, watchEffect } from "vue";
import { useResizable } from "@/hooks/resizable";

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

/** 头像取名字首字，中文取第一个字 */
const initial = (name?: string) => (name || '?').trim().charAt(0).toUpperCase()

/** 好友是否在线 */
const isOnline = (id?: string) => !!id && !!friendStore.getFriendMap[id]?.status
</script>

<style lang="scss" scoped>
.side-head {
    .ui-field {
        flex: 1;
        min-width: 0;
    }
}
</style>
