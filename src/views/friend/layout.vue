<template>
  <SidePanel v-model="username" :items="getFriends" :item-key="(item: any) => item.friend_info.id"
    :active-id="paramsID" :has-detail="hasDetail" :loading="friendStore.loading && !friendStore.friends.length"
    :loading-text="t('friend.loadingFriends')" :empty="getFriends.length === 0" empty-icon="users"
    :empty-text="t('friend.emptyList')" :search-placeholder="t('friend.searchPh')" @select="handleFriendClick">
    <template #head-actions>
      <router-link to="/friend/search" class="icon-btn" :title="t('friend.addFriend')">
        <AppIcon name="plus" :size="17" :stroke-width="1.6" />
      </router-link>
    </template>
    <template #row="{ item }">
      <UserAvatar :name="item.friend_info.username" :online="isOnline(item.friend_info.id)" />
      <span class="row-main">
        <span class="row-name">{{ item.friend_info.username }}</span>
      </span>
    </template>
    <template #body>
      <router-view></router-view>
    </template>
  </SidePanel>
</template>

<script setup lang="ts">
import { useFriendStore } from "@/store/modules/friend";
import router from "@/router";
import { useRoute } from "vue-router";
import { ref, computed, watchEffect } from "vue";
import { useI18n } from 'vue-i18n'
import { AppIcon, UserAvatar } from '@/components/ui'


import { SidePanel } from '@/components'


const { t } = useI18n()
const friendStore = useFriendStore();
const username = ref('')
const getFriends = computed(() => {
  return friendStore.friends.filter((friend: any) => friend.friend_info.username.includes(username.value))
})

const route = useRoute()
const paramsID = ref<string | undefined>(undefined)

watchEffect(() => {
  paramsID.value = route.params?.id as string
})

/** 移动端是否有详情视图：搜索页 / 聊天页都算，只有欢迎页不算
 *  （原来只看 params.id，导致 /friend/search 在窄屏下整个内容区 display:none） */
const hasDetail = computed(() => !!route.name && route.name !== 'friend-dashboard')

const handleFriendClick = (friend: any) => {
  router.push({
    name: "friend-info",
    params: {
      id: friend.friend_info.id,
    },
  });
};

/** 好友是否在线 */
const isOnline = (id?: string) => !!id && !!friendStore.getFriendMap[id]?.status
</script>

