<template>
  <div class="chat-shell">
    <div class="chat-main">
      <header class="chat-head">
        <span class="avatar avatar-lg">{{ initial }}</span>
        <div class="chat-head-main">
          <div class="chat-title">{{ getFriendInfo.username }}</div>
          <div class="chat-sub">
            <span class="dot" :class="{ 'dot-online': isFriendOnline }"></span>
            {{ isFriendOnline ? '在线' : '离线' }}
          </div>
        </div>
        <div class="chat-head-actions">
          <button type="button" class="icon-btn" title="语音通话" :disabled="!isFriendOnline" @click="handleStartCall">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
          </button>
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
        <div v-if="!getHistory.length" class="empty">
          <span class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.4A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 9 8.4Z" />
            </svg>
          </span>
          还没有聊天记录，发条消息打个招呼吧
        </div>

        <div v-for="message in getHistory" :key="message.id" class="msg"
          :class="{ 'is-me': message.sender !== route.params.id }">
          <div class="msg-meta">
            <span>{{ dayjs(message.timestamp).fromNow() }}</span>
            <span v-if="message.type">{{ formatFileSize(message.size) }}</span>
          </div>
          <div class="bubble">
            <Comment :message="message" />
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

    <aside v-show="infoVisiable" class="info">
      <div class="info-head">好友资料</div>

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

      <button type="button" class="btn btn-ghost btn-block btn-sm" @click="handleStartCall" :disabled="!isFriendOnline">
        发起语音通话
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
import { Socket } from "socket.io-client";
import dayjs from "@/plugin/dayjs";
import serverApi from "@/api";
import { vEnter } from "@/directives/vEnter";
import { formatFileSize, scrollToBottom } from "@/utils";
import { compressImage, imageFilename } from "@/utils/image";
import { usePaste } from "@/hooks/paste";
import { useResizable } from "@/hooks/resizable";
import { Comment } from "@/components";

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
// 无好友信息时，跳转404
watchEffect(() => {
  if (!getFriendInfo.value.id) router.push("404");
});

const initial = computed(() => (getFriendInfo.value.username || '?').trim().charAt(0).toUpperCase())

// 发起语音通话
const handleStartCall = () => {
  callStore.startCall({
    id: route.params.id as string,
    username: getFriendInfo.value.username as string,
  });
};

const handleSend = () => {
  if (!story.value) return;
  (socketStore.socket as Socket).emit("send:user", {
    sender: route.params.id,
    content: story.value,
  });
  story.value = "";
};
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
      (socketStore.socket as Socket).emit("send:user", {
        size: res.data.size,
        sender: route.params.id,
        content: `/${res.data.path}`,
        type: "image",
      });
    }
  });
};
const uploadFile = (file: Blob) => {
  const formData = new FormData();
  formData.append("file", file as Blob);
  serverApi.UploadUser(formData).then((res: any) => {
    if (res.code === 200) {
      (socketStore.socket as Socket).emit("send:user", {
        size: res.data.size,
        sender: route.params.id,
        originalname: res.data.originalname,
        content: `/${res.data.path}`,
        type: "file",
      });
    }
  });
};
onMounted(() => {
  document.getElementById("chooseImage")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadImage(file);
  });
  document.getElementById("chooseFile")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadFile(file);
  });

  scrollToBottom("messageContainer");
});

// 快捷上传图片及文件
usePaste(uploadImage, uploadFile);

// 自动滚到最新消息
watch(
  () => getHistory.value,
  () => {
    scrollToBottom("messageContainer");
  },
  { deep: true }
);

const infoVisiable = ref(true);
const handleSwitchInfo = () => {
  infoVisiable.value = !infoVisiable.value;
};
</script>

<style lang="scss" scoped>
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
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
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

@media (max-width: 900px) {
    .info {
        display: none;
    }
}
</style>
