<template>
  <SearchPage v-model.trim="roomName" :title="t('room.searchRooms')" :subtitle="t('room.searchSubtitle')"
    :placeholder="t('room.searchPlaceholder')" :back-title="t('room.backToList')" empty-icon="house" :results="result"
    @back="goBack" @submit="handleSearch">
    <template #result="{ item }">
      <div class="result-card">
        <UserAvatar :name="item.name" size="lg" />
        <div class="result-main">
          <div class="result-name">{{ item.name }}</div>
          <div class="result-desc">{{ item.description || t('room.noDescription') }}</div>
          <div class="result-meta">
            <span class="chip">{{ t('room.ownerLabel', { name: item.user_info?.username || '—' }) }}</span>
          </div>
        </div>

        <button v-if="!roomStore.getRoomMap[item.id]" type="button" class="btn btn-primary btn-sm"
          @click="handleJoin(item.id)">
          {{ t('room.applyJoin') }}
        </button>
        <span v-else class="chip chip-success">{{ t('room.joined') }}</span>
      </div>
    </template>
  </SearchPage>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from 'vue-i18n';
import { useRoomStore } from "@/store/modules/room";
import { NAV, useGoBack } from "@/utils/nav";
import ServerApi from "@/api";
import type { Room } from "@/store/modules/room";
import { toast } from "@/components/ui/toast";
import { SearchPage } from '@/components'

import { UserAvatar } from '@/components/ui'


/** 移动端搜索页是独立一屏，提供返回列表的入口 */
const goBack = useGoBack(NAV.roomList)
const roomName = ref("");

const result = ref<Room[]>([]);
const roomStore = useRoomStore();
const { t } = useI18n();

const handleSearch = () => {
  if (!roomName.value) {
    toast.warning(t('room.warnEmpty'))
    return
  }
  ServerApi.SearchRoom(roomName.value).then((res: any) => {
    if (res.code === 200) {
      result.value = res.data;
      if (!res.data?.length) toast.info(t('room.noMatch'))
    }
  });
};

const handleJoin = (room_id: string) => {
  ServerApi.apply({ room_id }).then((res: any) => {
    if (res.code === 200) {
      toast.success(t('room.applied'))
      roomName.value = ''
      result.value = []
    }
  })
};
</script>

