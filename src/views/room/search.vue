<template>
  <SearchPage v-model.trim="roomName" title="搜索房间" subtitle="输入房间名后回车，可申请加入感兴趣的聊天室"
    placeholder="输入房间名" back-title="返回房间列表" empty-icon="house" :results="result"
    @back="goBack" @submit="handleSearch">
    <template #result="{ item }">
      <div class="result-card">
        <UserAvatar :name="item.name" size="lg" />
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
    </template>
  </SearchPage>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useRoomStore } from "@/store/modules/room";
import { NAV, useGoBack } from "@/utils/nav";
import ServerApi from "@/api";
import type { Room } from "@/store/modules/room";
import { toast } from "@/components/ui/toast";
import SearchPage from "@/components/SearchPage.vue";
import UserAvatar from "@/components/ui/UserAvatar.vue";

/** 移动端搜索页是独立一屏，提供返回列表的入口 */
const goBack = useGoBack(NAV.roomList)
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

