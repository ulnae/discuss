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

        <button v-if="canApply(item)" type="button" class="btn btn-primary btn-sm"
          :disabled="joiningId === item.id" @click="handleJoin(item.id)">
          {{ joiningId === item.id ? t('room.joining') : t('room.applyJoin') }}
        </button>
        <span v-else-if="appliedIds.has(item.id)" class="chip">{{ t('room.joinedPending') }}</span>
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
/** 申请中的房间 id（防连点重复 POST /apply） */
const joiningId = ref<string | null>(null);
/** 本次会话已提交申请的房间：等 WS 回推期间也保持「已申请」，避免按钮瞬间复活 */
const appliedIds = ref(new Set<string>());
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

const canApplyId = (id?: string) =>
  !!id && !roomStore.getRoomMap[id] && !appliedIds.value.has(id)
const canApply = (item: Room) => canApplyId(item.id)

const handleJoin = (room_id: string) => {
  if (joiningId.value || !canApplyId(room_id)) return
  joiningId.value = room_id
  ServerApi.apply({ room_id }).then((res: any) => {
    if (res.code === 200) {
      appliedIds.value.add(room_id)
      toast.success(t('room.applied'))
      roomName.value = ''
      result.value = []
    }
  }).catch(() => {
    // 错误提示由 axios 拦截器统一处理
  }).finally(() => {
    joiningId.value = null
  })
};
</script>

