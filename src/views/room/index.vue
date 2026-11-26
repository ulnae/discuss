<template>
  <div class="chat-shell">
    <div class="chat-main">
      <ChatHeader :title="getRoomInfo.name || (roomStore.loading ? '加载中…' : '未知房间')"
        :subtitle="getRoomInfo.description || (roomStore.loading ? '' : '这个房间还没有描述')"
        back-title="返回房间列表" info-title="群成员" :info-active="infoVisiable" @back="goBack"
        @toggle-info="handleSwitchInfo" />

      <div id="messageContainer" ref="containerRef" class="chat-body">
        <div class="msg-list">
          <!-- 房间信息 / 成员（overview）在途：展示 loading；本地已有消息缓存则不打扰 -->
          <LoadingBlock v-if="roomStore.loading && !getHistory.length" text="正在加载…" />
          <EmptyState v-else-if="!getHistory.length" icon="room" text="群里还很安静，说点什么吧" />

          <div v-for="message in visibleMessages" :key="message.id" class="msg"
            :class="{ 'is-me': message.from === userStore.userInfo.id }">
            <div class="msg-meta">
              <span :class="{ 'sender-left': isLeftMember(message.from) }">{{ getSenderName(message.from) }}</span>
              <span>{{ formatRelative(message.timestamp) }}</span>
              <span v-if="message.type">{{ formatFileSize(message.size || 0) }}</span>
            </div>
            <div class="bubble">
              <MessageBubble :message="message" @resend="handleResend(message)" />
            </div>
          </div>
        </div>
      </div>

      <MessageComposer v-model.trim="story" :mention-members="mentionMembers"
        @send="handleSend" @image="handleSendImage" @file="handleSendFile" />
    </div>

    <DetailPanel :open="infoVisiable" title="群成员" :width="240" :loading="memberLoading"
      loading-text="正在加载群成员…" @close="infoVisiable = false">
      <template #title>
        群成员
        <span class="chip">{{ memberLoading ? '…' : getMember.length }}</span>
      </template>

      <div class="member-list">
        <TransitionGroup name="member" tag="div" class="member-rows" :key="String(route.params.id)">
          <div v-for="member in sortedMember" :key="member.user_id" class="member-row"
            :class="{ 'is-me': member.user_id === userStore.userInfo.id }">
            <UserAvatar :name="member.user_info.username" class="member-avatar"
              :online="getMemberOnline.has(member.user_id)" />
            <span class="row-main">
              <span class="row-name">{{ member.user_info.username }}</span>
            </span>
            <span class="owner-badge" v-if="getRoomInfo.creator === member.user_id">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M3 6.5l4.5 3.5L12 4l4.5 6L21 6.5 19 18H5L3 6.5z" />
              </svg>
              群主
            </span>
            <button v-if="getRoomInfo.creator !== member.user_id && roomStore.isOwnerOf(currentId())"
              type="button" class="icon-btn kick" title="移出群聊" @click="handleRemoveMember(member.id)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
                stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </TransitionGroup>
      </div>

      <template #footer>
        <button type="button" class="btn btn-ghost btn-block btn-sm danger-btn" @click="handleLeaveRoom">
          {{ isOwner ? '解散房间' : '退出房间' }}
        </button>
      </template>
    </DetailPanel>

    <input class="hidden" id="chooseImage" type="file" accept="image/*">
    <input class="hidden" id="chooseFile" type="file" accept="*">
  </div>
</template>

<script setup lang="ts">
import { useSocketStore } from "@/store/modules/socket";
import { useUserStore } from "@/store/modules/user";
import { useRoomStore } from "@/store/modules/room";
import { computed, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";

import serverApi from "@/api";
import { formatFileSize } from "@/utils";
import { formatRelative } from "@/utils/format";
import { NAV, useGoBack } from "@/utils/nav";
import { useChatSession } from "@/hooks/useChatSession";
import { MessageBubble, UserAvatar, LoadingBlock, EmptyState, DetailPanel, MessageComposer, ChatHeader } from '@/components'
import { toast } from '@/components/ui/toast'
import { showConfirm } from '@/components/ui/confirm'

const socketStore = useSocketStore();
const userStore = useUserStore();
const roomStore = useRoomStore();

const route = useRoute();
const router = useRouter()

// 获取房间消息历史
const getHistory = computed(() => {
  return socketStore.roomMessageMap.get(route.params.id as string) || [];
});

const currentId = () => route.params.id as string
const {
  story,
  containerRef,
  visibleMessages,
  hasEarlierMessages,
  handleSend,
  handleResend,
  handleSendImage,
  handleSendFile,
  infoVisiable,
  handleSwitchInfo,
} = useChatSession({
  history: getHistory,
  send: (content, meta) => socketStore.sendRoom(currentId(), content, meta),
  resend: message => socketStore.resendMessage(message),
});
// 获取房间成员
const getMember = computed(() => {
  return socketStore.roomMemberMap.get(route.params.id as string) || [];
});
// 群成员名单是否仍在加载（overview 在途且本地还没有该房间成员）
const memberLoading = computed(() => roomStore.loading && !getMember.value.length);
// 获取房间成员在线状态
const getMemberOnline = computed(() => {
  return (
    socketStore.roomMemberOnlineMap.get(route.params.id as string) || new Set()
  );
});
// 群成员排序：群主（含离线）恒定第一 → 在线成员 → 离线成员；
// 组内保持后端原始顺序（稳定排序用原始下标做 tiebreak，避免推送导致无关成员乱跳）
const sortedMember = computed(() => {
  const online = getMemberOnline.value;
  const ownerId = getRoomInfo.value.creator;
  const rank = (m: any) =>
    m.user_id === ownerId ? 0 : online.has(m.user_id) ? 1 : 2;
  return getMember.value
    .map((m: any, i: number) => ({ m, i }))
    .sort((a: any, b: any) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map((x: any) => x.m);
});
// @ 候选成员：复用群主→在线→离线的排序，补上在线标记（仅群聊传给输入框）
const mentionMembers = computed(() => sortedMember.value.map((m: any) => ({
  ...m,
  online: getMemberOnline.value.has(m.user_id),
})));
// 群成员名字兜底文案：成员已退出/被移出（不在当前成员列表）时统一显示
const LEFT_MEMBER_LABEL = '已退出成员';
// 发送者是否已退出（自己发的消息不算）
const isLeftMember = (user_id: string) => {
  if (user_id === userStore.userInfo.id) return false;
  return !getMember.value.some((item: any) => item.user_id === user_id);
};
// 获取发送者名称：本人→本人用户名；在群成员→其用户名；已退出→兜底文案
const getSenderName = (user_id: string) => {
  if (user_id === userStore.userInfo.id) return userStore.userInfo.username;
  return getMember.value.find((item: any) => item.user_id === user_id)
    ?.user_info?.username || LEFT_MEMBER_LABEL;
};
// 获取房间信息
const getRoomInfo = computed(() => {
  return roomStore.getRoomMap[route.params.id as string]?.room_info || {};
});
// 房间列表已加载但找不到该房间（被踢 / 被解散）时回房间列表，而不是甩一个 404
watchEffect(() => {
  if (!roomStore.rooms.length) return
  if (!getRoomInfo.value.id) router.replace(NAV.roomList)
})

// 群主：可解散房间、移出成员；其他人只能自己退出
const isOwner = computed(() => !!getRoomInfo.value.creator && getRoomInfo.value.creator === userStore.userInfo.id)

async function handleLeaveRoom() {
  const roomId = currentId()
  const name = getRoomInfo.value.name || '房间'

  if (isOwner.value) {
    if (!(await showConfirm(`解散后所有成员都会被移出，确定解散「${name}」吗？`, {
      title: '解散房间',
      danger: true
    }))) return
    const res: any = await serverApi.DeleteRoom(roomId)
    if (res.code === 200) {
      roomStore.removeRoom(roomId)
      toast.success('房间已解散')
      router.replace(NAV.roomList)
    }
    return
  }

  const self = getMember.value.find((item: any) => item.user_id === userStore.userInfo.id)
  if (!self) {
    toast.warning('你已不在该房间')
    router.replace(NAV.roomList)
    return
  }
  if (!(await showConfirm(`确定退出「${name}」吗？`, { title: '退出房间', danger: true }))) return

  const res: any = await serverApi.RemoveMember(self.id)
  if (res.code === 200) {
    roomStore.removeRoom(roomId)
    // 提示交给服务端回推的 ROOM_LEFT（含房间名、多标签页同步），避免本地重复弹
    router.replace(NAV.roomList)
  }
}

async function handleRemoveMember(id: string) {
  if (!(await showConfirm('确定把该成员移出房间吗？对方会立刻收到通知', {
    title: '移出成员',
    danger: true
  }))) return
  const res: any = await serverApi.RemoveMember(id)
  if (res.code === 200) {
    roomStore.getRoomMember(currentId());
    toast.success('已移出成员')
  }
}

const goBack = useGoBack(NAV.roomList)
</script>

<style lang="scss" scoped>
/* 历史消息发送者：成员已退出时用次要色弱化显示，与在群成员区分 */
.msg-meta .sender-left {
  color: var(--text-3);
}

.member-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

/* TransitionGroup 的移动动画：在线状态切换导致成员重排时平滑位移 */
.member-move {
    transition: transform 0.32s var(--ease);
}

/* 尊重系统「减少动态效果」偏好 */
@media (prefers-reduced-motion: reduce) {
    .member-row,
    .member-move {
        transition: none;
    }
}

.member-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.32rem 0.35rem;
    border-radius: 9px;
    /* transform 与 hover 底色共用一条 transition：切 room 时整组重建不触发位移，
       在线状态变化引起的重排由 .member-move 的 FLIP 平滑过渡 */
    transition: background-color 0.16s ease, transform 0.32s var(--ease);

    &:hover {
        background: var(--surface-2);

        .kick {
            opacity: 1;
        }
    }

    &.is-me .row-name {
        font-weight: 600;
    }
}

.member-avatar {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    font-size: 0.68rem;
    --presence-size: 8px;
    --presence-ring: 1.5px;
}

/* 群主身份徽章：项目主色墨黑 + 皇冠图标，与申请页徽章/头像同一色板，凸显身份 */
.owner-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
    padding: 0.08rem 0.4rem;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-fg);
    font-size: 0.64rem;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;

    svg {
        width: 11px;
        height: 11px;
    }
}

.kick {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    opacity: 0;
    transition: opacity 0.16s ease, background-color 0.16s ease, color 0.16s ease;

    svg {
        width: 13px;
        height: 13px;
    }

    &:hover {
        color: var(--danger);
    }
}

/* 触摸设备没有 hover，踢人按钮常显 */
@media (max-width: 900px) {
    .kick {
        opacity: 0.7;
    }
}
</style>
