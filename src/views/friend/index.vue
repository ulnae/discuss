<template>
  <div class="chat-shell">
    <div class="chat-main">
      <ChatHeader :title="getFriendInfo.username || (friendStore.loading ? '加载中…' : '未知好友')"
        :subtitle="getFriendInfo.email || (friendStore.loading ? '' : '—')" back-title="返回好友列表"
        info-title="好友资料" :info-active="infoVisiable" @back="goBack" @toggle-info="handleSwitchInfo" />

      <div id="messageContainer" ref="containerRef" class="chat-body">
        <div class="msg-list">
          <!-- 好友列表（资料来源）在途：展示 loading；本地已有消息缓存则不打扰 -->
          <div v-if="friendStore.loading && !getHistory.length" class="list-loading">
            <span class="loading-spinner"></span>
            正在加载…
          </div>
          <div v-else-if="!getHistory.length" class="empty">
            <span class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.4A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4Z" />
              </svg>
            </span>
            还没有聊天记录，发条消息打个招呼吧
          </div>

          <div v-for="message in visibleMessages" :key="message.id" class="msg"
            :class="{ 'is-me': message.from !== route.params.id }">
            <div class="msg-meta">
              <span>{{ dayjs(message.timestamp).fromNow() }}</span>
              <span v-if="message.type">{{ formatFileSize(message.size || 0) }}</span>
            </div>
            <div class="bubble">
              <Comment :message="message" @resend="handleResend(message)" />
            </div>
          </div>
        </div>
      </div>

      <MessageComposer v-model.trim="story" @send="handleSend" @image="handleSendImage" @file="handleSendFile">
        <template #actions>
          <button type="button" class="icon-btn" title="语音通话" :disabled="!isFriendOnline"
            @click="handleStartCall">
            <AppIcon name="phone" :size="18" :stroke-width="1.6" />
          </button>
        </template>
      </MessageComposer>
    </div>

    <div v-show="infoVisiable" class="info-mask" @click="infoVisiable = false"></div>

    <aside v-show="infoVisiable" class="info">
      <div class="info-head">
        <span>好友资料</span>
        <button type="button" class="icon-btn info-close" title="关闭" @click="infoVisiable = false">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 好友资料随列表一起加载：在途时用 loading 占位，避免头像/用户名先闪出 ? 和 — -->
      <div v-if="infoLoading" class="list-loading panel-loading">
        <span class="loading-spinner"></span>
        正在加载好友资料…
      </div>

      <template v-else>
      <div class="info-card">
        <span class="avatar avatar-xl">{{ initial }}</span>
        <div class="info-name">{{ getFriendInfo.username }}</div>
        <div class="chat-sub">
          <span class="dot" :class="{ 'dot-online': isFriendOnline }"></span>
          {{ isFriendOnline ? '在线' : '离线' }}
        </div>
      </div>

      <div class="info-list">
        <div class="info-row">
          <span class="info-k">用户名</span>
          <span class="info-v">{{ getFriendInfo.username || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-k">邮箱</span>
          <span class="info-v">{{ getFriendInfo.email || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="info-k">注册于</span>
          <span class="info-v">{{ getFriendInfo.createdAt ? dayjs(getFriendInfo.createdAt).format('YYYY/MM/DD') : '—' }}</span>
        </div>
      </div>
      </template>

      <button v-if="!infoLoading" type="button" class="btn btn-ghost btn-block btn-sm danger-btn leave-room-btn" @click="handleRemoveFriend">
        删除好友
      </button>
    </aside>

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

import dayjs from "@/plugin/dayjs";
import serverApi from "@/api";
import { formatFileSize } from "@/utils";
import { useChatSession } from "@/hooks/useChatSession";
import { Comment } from "@/components";
import MessageComposer from "@/components/MessageComposer.vue";
import ChatHeader from "@/components/ChatHeader.vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import { toast } from "@/components/ui/toast";

const socketStore = useSocketStore();
const friendStore = useFriendStore();
const callStore = useCallStore();

const route = useRoute();
const router = useRouter();

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
  if (!getFriendInfo.value.id) router.replace('/friend/dashboard')
});

const initial = computed(() => (getFriendInfo.value.username || '?').trim().charAt(0).toUpperCase())

// 删除好友：双向生效，对方会实时收到 friend:removed
const handleRemoveFriend = async () => {
  const friendId = route.params.id as string
  const name = getFriendInfo.value.username || '该好友'
  if (!window.confirm(`删除后双方好友列表都会消失，确定删除「${name}」吗？`)) return

  const res: any = await serverApi.RemoveFriend(friendId)
  if (res.code === 200) {
    friendStore.removeFriend(friendId)
    toast.success('已删除好友')
    router.replace('/friend/dashboard')
  }
}

// 发起语音通话
const handleStartCall = () => {
  callStore.startCall({
    id: route.params.id as string,
    username: getFriendInfo.value.username as string,
  });
};

const goBack = () => router.push('/friend/dashboard')
</script>

<style lang="scss" scoped>
/* 顶部标题区与左侧搜索区（.side-head）整体同高，同群聊天页头部：
   padding 节奏一致（0.7rem / 0.6rem），标题 + 邮箱压进一行内容高度内 */
.chat-head {
    padding-top: 0.7rem;
    padding-bottom: 0.6rem;
}

.chat-title {
    line-height: 1.15;
}

/* 邮箱作为标题副行，单行展示，超长省略 */
.chat-sub {
    display: block;
    line-height: 1.2;
    /* loading 时副行为空字符串，锁住一行高度，避免加载完成瞬间标题整体跳动 */
    min-height: 1.2em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.info {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 0.85rem;
    width: 224px;
    padding: 0.9rem;
    border-left: 1px solid var(--border);
    overflow-y: auto;
}

.info-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-2);
}

/* 抽屉关闭按钮：窄屏抽屉形态下必须可见，否则关不掉 */
.info-close {
    width: 26px;
    height: 26px;
    border-radius: 8px;

    svg {
        width: 14px;
        height: 14px;
    }
}

/* 资料 / 成员面板内的 loading 占位：比通用列表更紧凑 */
.panel-loading {
    padding: 2rem 0.5rem;
}

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

/* 删除好友按钮贴在资料面板底部，同群房间页的退出/解散按钮 */
.leave-room-btn {
    margin-top: auto;
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

/* 移动端：资料面板做成右侧抽屉，不再直接隐藏（隐藏后就没法删除好友了） */
.info-mask {
    display: none;
}

@media (max-width: 900px) {
    .chat-shell {
        position: relative;
    }

    .info {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 30;
        width: min(86%, 320px);
        border-left: 1px solid var(--border);
        background: var(--surface-solid);
        box-shadow: var(--drawer-shadow);
    }

    .info-mask {
        /* 基础样式是 display:none，这里必须恢复显示，否则遮罩永远不出现、抽屉关不掉 */
        display: block;
        position: absolute;
        inset: 0;
        z-index: 25;
        background: var(--mask-bg);
        backdrop-filter: blur(1px);
    }
}
</style>
