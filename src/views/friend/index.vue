<template>
  <div class="chat-shell">
    <div class="chat-main">
      <header class="chat-head">
        <button type="button" class="icon-btn back-btn" title="返回好友列表" @click="goBack">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span class="avatar avatar-lg">{{ initial }}</span>
        <div class="chat-head-main">
          <div class="chat-title">{{ getFriendInfo.username }}</div>
          <div class="chat-sub" :title="getFriendInfo.email">
            {{ getFriendInfo.email || '—' }}
          </div>
        </div>
        <div class="chat-head-actions">
          <button type="button" class="icon-btn" :class="{ 'is-active': infoVisiable }" title="好友资料"
            @click="handleSwitchInfo">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </button>
        </div>
      </header>

      <div id="messageContainer" class="chat-body">
        <button v-if="hasEarlierMessages" type="button" class="load-earlier" @click="visibleCount += 100">
          查看更早的消息
        </button>
        <div v-if="!getHistory.length" class="empty">
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
            <span v-if="message.type">{{ formatFileSize(message.size) }}</span>
          </div>
          <div class="bubble">
            <Comment :message="message" @resend="handleResend(message)" />
          </div>
        </div>
      </div>

      <div ref="inputAreaRef" class="composer">
        <div class="composer-box">
          <textarea id="story" v-enter="handleSend" v-model.trim="story" name="story"
            placeholder="输入消息，回车发送（Shift + 回车换行）"></textarea>
          <div class="composer-actions">
            <button type="button" class="icon-btn" title="语音通话" :disabled="!isFriendOnline"
              @click="handleStartCall">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
                stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </button>
            <button type="button" class="icon-btn" title="发送图片" @click="handleSendImage">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
                stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z" />
              </svg>
            </button>
            <button type="button" class="icon-btn" title="发送文件" @click="handleSendFile">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
                stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
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

      <button type="button" class="btn btn-ghost btn-block btn-sm danger-btn leave-room-btn" @click="handleRemoveFriend">
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
import { computed, onMounted, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";

import dayjs from "@/plugin/dayjs";
import serverApi from "@/api";
import { vEnter } from "@/directives/vEnter";
import { formatFileSize, scrollToBottom } from "@/utils";
import { compressImage, imageFilename } from "@/utils/image";
import { usePaste } from "@/hooks/paste";
import { useResizable } from "@/hooks/resizable";
import { Comment } from "@/components";
import { toast } from "@/components/ui/toast";

const socketStore = useSocketStore();
const friendStore = useFriendStore();
const callStore = useCallStore();

const story = ref("");
const inputAreaRef = ref<HTMLElement | null>(null);
useResizable(inputAreaRef, { direction: 'vertical', minSize: 150, maxSize: 600, initialSize: 180 });
const route = useRoute();
const router = useRouter();

const getHistory = computed(() => {
  return socketStore.userMessageMap.get(route.params.id as string) || [];
});

const getFriendInfo = computed(() => {
  return friendStore.getFriendMap[route.params.id as string]?.friend_info || {};
});
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

// 发送消息（走 store 乐观发送：先上屏，回执后对账）
const handleSend = () => {
  if (!story.value) return;
  socketStore.sendUser(route.params.id as string, story.value);
  story.value = "";
};

const handleResend = (message: any) => socketStore.resendMessage(message);
const handleSendImage = () => {
  document.getElementById("chooseImage")?.click();
};
const handleSendFile = () => {
  document.getElementById("chooseFile")?.click();
};

const uploadImage = async (file: Blob) => {
  const blob = await compressImage(file);
  const formData = new FormData();
  formData.append("file", blob, imageFilename(blob));
  serverApi.UploadUser(formData).then((res: any) => {
    if (res.code === 200) {
      socketStore.sendUser(route.params.id as string, `/${res.data.path}`, {
        type: "image",
        size: res.data.size,
      });
    }
  }).catch(() => { /* 失败提示由 axios 拦截器统一弹出 */ });
};
const uploadFile = (file: Blob) => {
  const formData = new FormData();
  formData.append("file", file as Blob);
  serverApi.UploadUser(formData).then((res: any) => {
    if (res.code === 200) {
      socketStore.sendUser(route.params.id as string, `/${res.data.path}`, {
        type: "file",
        size: res.data.size,
        originalname: res.data.originalname,
      });
    }
  }).catch(() => { /* 失败提示由 axios 拦截器统一弹出 */ });
};
onMounted(() => {
  document.getElementById("chooseImage")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadImage(file);
    (e.target as HTMLInputElement).value = "";
  });
  document.getElementById("chooseFile")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadFile(file);
    (e.target as HTMLInputElement).value = "";
  });

  scrollToBottom("messageContainer");
});

// 快捷上传图片及文件
usePaste(uploadImage, uploadFile);

// 聊天区只渲染最近 100 条，避免长会话 DOM 堆积；更早的点击按钮分页加载
const visibleCount = ref(100)
const visibleMessages = computed(() => getHistory.value.slice(-visibleCount.value))
const hasEarlierMessages = computed(() => getHistory.value.length > visibleCount.value)

// 换好友时把「已展开的条数」收回去，避免上个会话的展开状态带过来
watch(
  () => route.params.id,
  () => { visibleCount.value = 100 }
)

// 新消息到达时自动滚到底部（监听最后一条 id，替代原 deep watch 的全量 diff）
watch(
  () => getHistory.value[getHistory.value.length - 1]?.id,
  () => {
    scrollToBottom("messageContainer");
  }
);

const infoVisiable = ref(!isNarrow());
const handleSwitchInfo = () => {
  infoVisiable.value = !infoVisiable.value;
};

/** 窄屏默认收起资料面板，避免聊天区被挤成一条缝 */
function isNarrow() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
}

const goBack = () => router.push('/friend/dashboard')
</script>

<style lang="scss" scoped>
/* 顶部标题区与左侧搜索区（.side-head）整体同高，同群聊天页头部：
   padding 节奏一致（0.7rem / 0.6rem），头像压到 34px，标题 + 邮箱压进一行内容高度内 */
.chat-head {
    padding-top: 0.7rem;
    padding-bottom: 0.6rem;
}

.chat-head .avatar-lg {
    width: 34px;
    height: 34px;
    border-radius: 10px;
}

.chat-title {
    line-height: 1.15;
}

/* 邮箱作为标题副行，单行展示，超长省略 */
.chat-sub {
    display: block;
    line-height: 1.2;
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
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
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

/* 查看更早的消息 */
.load-earlier {
    align-self: center;
    margin: 0.2rem 0;
    padding: 0.25rem 0.7rem;
    border: 0;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-3);
    font-size: 0.7rem;
    cursor: pointer;
    transition: background-color 0.16s ease, color 0.16s ease;

    &:hover {
        color: var(--text);
    }
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
    color: var(--text-3);
}

.info-v {
    font-size: 0.78rem;
    color: var(--text);
    word-break: break-all;
}

.composer {
    display: flex;
}

.composer-box {
    flex: 1;
    min-width: 0;
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
        box-shadow: -24px 0 48px -24px rgba(15, 23, 42, 0.45);
    }

    .info-mask {
        /* 基础样式是 display:none，这里必须恢复显示，否则遮罩永远不出现、抽屉关不掉 */
        display: block;
        position: absolute;
        inset: 0;
        z-index: 25;
        background: rgba(15, 23, 42, 0.28);
        backdrop-filter: blur(1px);
    }
}

html.dark .info {
    box-shadow: -24px 0 48px -24px rgba(0, 0, 0, 0.75);
}
</style>
