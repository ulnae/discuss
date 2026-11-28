<template>
  <div class="chat-shell">
    <div class="chat-main">
      <ChatHeader :title="getFriendInfo.username || (friendStore.loading ? t('common.loading') : t('friend.unknownFriend'))"
        :subtitle="getFriendInfo.email || (friendStore.loading ? '' : '—')" :back-title="t('friend.backToList')"
        :info-title="t('friend.infoTitle')" :info-active="infoVisiable" @back="goBack" @toggle-info="handleSwitchInfo" />

      <div id="messageContainer" ref="containerRef" class="chat-body">
        <div class="msg-list">
          <!-- 好友列表（资料来源）在途：展示 loading；本地已有消息缓存则不打扰 -->
          <LoadingBlock v-if="friendStore.loading && !getHistory.length" :text="t('common.loading')" />
          <EmptyState v-else-if="!getHistory.length" icon="chat" :text="t('friend.emptyChat')" />

          <div v-for="message in visibleMessages" :key="message.id" class="msg"
            :class="{ 'is-me': message.from !== route.params.id }">
            <div class="msg-meta">
              <span>{{ formatRelative(message.timestamp) }}</span>
              <span v-if="message.type">{{ formatFileSize(message.size || 0) }}</span>
            </div>
            <div class="bubble">
              <MessageBubble :message="message" @resend="handleResend(message)" />
            </div>
          </div>
        </div>
      </div>

      <MessageComposer v-model.trim="story" @send="handleSend" @image="handleSendImage" @file="handleSendFile">
        <template #actions>
          <button type="button" class="icon-btn" :title="t('friend.voiceCall')" :disabled="!isFriendOnline"
            @click="handleStartCall">
            <AppIcon name="phone" :size="18" :stroke-width="1.6" />
          </button>
        </template>
      </MessageComposer>
    </div>

    <DetailPanel :open="infoVisiable" :title="t('friend.infoTitle')" :loading="infoLoading" :loading-text="t('friend.loadingInfo')"
      @close="infoVisiable = false">
      <div class="info-card">
        <UserAvatar :name="getFriendInfo.username" size="xl" :online="isFriendOnline" />
        <div class="info-name">{{ getFriendInfo.username }}</div>
        <div class="chat-sub">
          {{ isFriendOnline ? t('common.online') : t('common.offline') }}
        </div>
      </div>

      <div class="info-list">
        <div class="info-row">
          <span class="info-k">{{ t('friend.fieldUsername') }}</span>
          <span class="info-v">{{ getFriendInfo.username || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-k">{{ t('friend.fieldEmail') }}</span>
          <span class="info-v">{{ getFriendInfo.email || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-k">{{ t('friend.fieldJoined') }}</span>
          <span class="info-v">{{ formatDate(getFriendInfo.createdAt) }}</span>
        </div>
      </div>

      <template #footer>
        <button type="button" class="btn btn-ghost btn-block btn-sm danger-btn" :disabled="removing"
          @click="handleRemoveFriend">
          {{ removing ? t('friend.removing') : t('friend.deleteFriend') }}
        </button>
      </template>
    </DetailPanel>

    <input class="hidden" id="chooseImage" type="file" accept="image/*">
    <input class="hidden" id="chooseFile" type="file" accept="*">
  </div>
</template>

<script setup lang="ts">
import { useSocketStore } from "@/store/modules/socket";
import { useFriendStore } from "@/store/modules/friend";
import { useCallStore } from "@/store/modules/call";
import { computed, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import serverApi from "@/api";
import { formatFileSize } from "@/utils";
import { formatDate, formatRelative } from "@/utils/format";
import { NAV, useGoBack } from "@/utils/nav";
import { useChatSession } from "@/hooks/useChatSession";
import { MessageBubble, AppIcon, UserAvatar, LoadingBlock, EmptyState, DetailPanel, MessageComposer, ChatHeader } from '@/components'
import { toast } from "@/components/ui/toast";
import { showConfirm } from "@/components/ui/confirm";

const socketStore = useSocketStore();
const friendStore = useFriendStore();
const callStore = useCallStore();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const getHistory = computed(() => {
  return socketStore.userMessageMap.get(route.params.id as string) || [];
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
  send: (content, meta) => socketStore.sendUser(currentId(), content, meta),
  resend: message => socketStore.resendMessage(message),
});

const getFriendInfo = computed(() => {
  return friendStore.getFriendMap[route.params.id as string]?.friend_info || {};
});
// 好友资料是否仍在加载（列表在途且本地还没有该好友信息）
const infoLoading = computed(() => friendStore.loading && !getFriendInfo.value.id);
// 好友是否在线（在线才允许拨打语音通话）
const isFriendOnline = computed(() => {
  return !!friendStore.getFriendMap[route.params.id as string]?.status;
});
// 好友列表已加载但找不到这个人（被删除 / 链接失效）时回好友列表
watchEffect(() => {
  if (!friendStore.friends.length) return
  if (!getFriendInfo.value.id) router.replace(NAV.friendList)
});

// 删除好友：双向生效，对方会实时收到 friend:removed
const removing = ref(false)
const handleRemoveFriend = async () => {
  if (removing.value) return
  removing.value = true
  try {
    const friendId = currentId()
    const name = getFriendInfo.value.username || t('friend.thisFriend')
    if (!(await showConfirm(t('friend.confirmDelete', { name }), {
      title: t('friend.deleteFriend'),
      danger: true
    }))) return

    const res: any = await serverApi.RemoveFriend(friendId)
    if (res.code === 200) {
      friendStore.removeFriend(friendId)
      toast.success(t('friend.deleted'))
      router.replace(NAV.friendList)
    }
  } finally {
    removing.value = false
  }
}

// 发起语音通话
const handleStartCall = () => {
  callStore.startCall({
    id: currentId(),
    username: getFriendInfo.value.username as string,
  });
};

const goBack = useGoBack(NAV.friendList)
</script>

<style lang="scss" scoped>
.info-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.1rem 0.75rem;
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    text-align: center;
}

.info-name {
    font-size: 0.88rem;
    font-weight: 600;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.info-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
}

.info-row {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.info-k {
    font-size: 0.68rem;
    color: var(--text-2);
}

.info-v {
    font-size: 0.78rem;
    color: var(--text);
    word-break: break-all;
}
</style>
