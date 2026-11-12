<template>
  <div class="chat-shell">
    <div class="chat-main">
      <header class="chat-head">
        <span class="avatar avatar-lg">{{ initial }}</span>
        <div class="chat-head-main">
          <div class="chat-title">{{ getRoomInfo.name }}</div>
          <div class="chat-sub">
            共 {{ getMember.length }} 位成员
            <span class="chat-sub-sep">·</span>
            <span class="dot dot-online"></span>
            {{ getMemberOnline.size }} 人在线
          </div>
        </div>
        <div class="chat-head-actions">
          <button type="button" class="icon-btn" :class="{ 'is-active': infoVisiable }" title="群成员"
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
              <path d="M20.25 8.5c.9.3 1.5 1.1 1.5 2.1v4.3c0 1.1-.8 2.1-2 2.2l-1 .1v3l-3-3c-1.4 0-2.7-.1-4-.2" />
              <path d="M16.5 6.6c0-1.6-1.2-3-2.8-3.2A48 48 0 0 0 5 3.4C3.4 3.6 2.2 5 2.2 6.6v6.2c0 1.6 1.2 3 2.8 3.2L7 16.2V21l4.2-4.2" />
            </svg>
          </span>
          群里还很安静，说点什么吧
        </div>

        <div v-for="message in getHistory" :key="message.id" class="msg"
          :class="{ 'is-me': message.sender === userStore.userInfo.id }">
          <div class="msg-meta">
            <span>{{ message.sender === userStore.userInfo.id ? userStore.userInfo.username : getUserInfo(message.sender) }}</span>
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

    <aside v-show="infoVisiable" class="members">
      <section class="members-block">
        <header class="members-head">
          群成员
          <span class="chip">{{ getMember.length }}</span>
        </header>
        <div class="member-list">
          <div v-for="member in getMember" :key="member.user_id" class="member-row"
            :class="{ 'is-me': member.user_id === userStore.userInfo.id, 'is-online': getMemberOnline.has(member.user_id) }">
            <span class="avatar">{{ (member.user_info.username || '?').charAt(0).toUpperCase() }}</span>
            <span class="row-main">
              <span class="row-name">{{ member.user_info.username }}</span>
            </span>
            <span class="chip chip-warning" v-if="getRoomInfo.creator === member.user_id">群主</span>
            <span class="dot" :class="{ 'dot-online': getMemberOnline.has(member.user_id) }"></span>
            <button v-if="getRoomInfo.creator !== member.user_id && roomStore.roomsMine.find((item: any) => item.id === route.params.id)"
              type="button" class="icon-btn kick" title="移出群聊" @click="handleRemoveMember(member.id)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
                stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section v-if="applyList.length > 0" class="members-block">
        <header class="members-head">
          入群申请
          <span class="chip chip-warning">{{ applyList.length }}</span>
        </header>
        <div class="apply-list">
          <div v-for="apply in applyList" :key="apply.id" class="apply-row">
            <span class="row-main">
              <span class="row-name">{{ apply.user_info.username }}</span>
              <span class="row-sub">申请加入房间</span>
            </span>
            <template v-if="apply.handle_status">
              <span class="chip" :class="apply.status ? 'chip-success' : 'chip-danger'">
                {{ apply.status ? '已同意' : '已拒绝' }}
              </span>
            </template>
            <template v-else>
              <button type="button" class="btn btn-primary btn-sm" @click="handleHandleApply(apply, true)">同意</button>
              <button type="button" class="btn btn-ghost btn-sm" @click="handleHandleApply(apply, false)">拒绝</button>
            </template>
          </div>
        </div>
      </section>
    </aside>

    <input class="hidden" id="chooseImage" type="file" accept="image/*">
    <input class="hidden" id="chooseFile" type="file" accept="*">
  </div>
</template>

<script setup lang="ts">
import { useSocketStore } from "@/store/modules/socket";
import { useUserStore } from "@/store/modules/user";
import { useRoomStore } from "@/store/modules/room";
import { ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Socket } from "socket.io-client";
import { computed, onMounted } from "vue";
import ServerApi from "@/api";
import dayjs from "@/plugin/dayjs";
import serverApi from "@/api";
import { vEnter } from "@/directives/vEnter";
import { formatFileSize, scrollToBottom } from "@/utils";
import { compressImage, imageFilename } from "@/utils/image";
import { usePaste } from '@/hooks/paste'
import { useResizable } from '@/hooks/resizable'
import { Comment } from '@/components'

const socketStore = useSocketStore();
const userStore = useUserStore();
const roomStore = useRoomStore();
const story = ref("");
const inputAreaRef = ref<HTMLElement | null>(null);
useResizable(inputAreaRef, { direction: 'vertical', minSize: 150, maxSize: 600, initialSize: 180 });
const route = useRoute();
const router = useRouter()

// 获取房间消息历史
const getHistory = computed(() => {
  return socketStore.roomMessageMap.get(route.params.id as string) || [];
});
// 获取房间成员
const getMember = computed(() => {
  return socketStore.roomMemberMap.get(route.params.id as string) || [];
});
// 获取房间成员在线状态
const getMemberOnline = computed(() => {
  return (
    socketStore.roomMemberOnlineMap.get(route.params.id as string) || new Set()
  );
});
// 获取用户信息
const getUserInfo = (user_id: string) => {
  return getMember.value.find((item: any) => item.user_id === user_id)
    ?.user_info?.username;
};
// 获取房间信息
const getRoomInfo = computed(() => {
  return roomStore.getRoomMap[route.params.id as string]?.room_info || {};
});
const initial = computed(() => (getRoomInfo.value.name || '?').trim().charAt(0).toUpperCase())
// 无房间信息时，跳转404
watchEffect(() => {
  if (!getRoomInfo.value.id) router.push('404')
})

// 监听路由变化
const applyList = ref<any[]>([]);
watch(
  () => route.params.id,
  () => {
    handleApplyRoom();
  }
);

function handleApplyRoom() {
  if (!roomStore.roomsMine.find((item: any) => item.id === route.params.id)) {
    return (applyList.value = []);
  }
  ServerApi.getApplyRoom(route.params.id as string).then((res: any) => {
    applyList.value = res.data || [];
  });
}
handleApplyRoom();

// 处理申请
function handleHandleApply(apply: any, status: boolean) {
  ServerApi.handleApply({
    id: apply.id,
    status,
  }).then((res: any) => {
    if (res.code === 200) {
      handleApplyRoom();
      // 同意申请后，刷新获取房间成员
      status && roomStore.getRoomMember(route.params.id as string);
    }
  });
}

// 发送消息
const handleSend = () => {
  if (!story.value) return;
  (socketStore.socket as Socket).emit("send:room", {
    room: route.params.id,
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
      (socketStore.socket as Socket).emit("send:room", {
        size: res.data.size,
        room: route.params.id,
        content: `/${res.data.path}`,
        type: "image",
      });
    }
  });
}

const uploadFile = (file: Blob) => {
  const formData = new FormData();
  formData.append("file", file as Blob);
  serverApi.UploadUser(formData).then((res: any) => {
    if (res.code === 200) {
      (socketStore.socket as Socket).emit("send:room", {
        size: res.data.size,
        room: route.params.id,
        content: `/${res.data.path}`,
        type: "file",
        originalname: res.data.originalname,
      });
    }
  });
}
onMounted(() => {
  document.getElementById("chooseImage")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadImage(file)
  });
  document.getElementById("chooseFile")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadFile(file)
  });

  scrollToBottom('messageContainer');
});

// 快捷上传图片及文件
usePaste(uploadImage, uploadFile)

// 自动滚到最新消息
watch(
  () => getHistory.value,
  () => {
    scrollToBottom('messageContainer');
  },
  { deep: true }
);

const infoVisiable = ref(true)
const handleSwitchInfo = () => {
  infoVisiable.value = !infoVisiable.value
}


function handleRemoveMember(id: string) {
  ServerApi.RemoveMember(id).then((res: any) => {
    if (res.code === 200) {
      roomStore.getRoomMember(route.params.id as string);
    }
  });
}
</script>

<style lang="scss" scoped>
.chat-sub-sep {
    color: var(--text-3);
}

.composer {
    display: flex;
}

.composer-box {
    flex: 1;
    min-width: 0;
}

.members {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 1rem;
    width: 240px;
    padding: 0.9rem;
    border-left: 1px solid var(--border);
    overflow-y: auto;
}

.members-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.members-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
}

.member-list,
.apply-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.member-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.32rem 0.35rem;
    border-radius: 9px;
    transition: background-color 0.16s ease;

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

.member-row .avatar {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    font-size: 0.68rem;
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

.apply-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.35rem;
    border-radius: 9px;

    &:hover {
        background: var(--surface-2);
    }

    .btn {
        height: 1.7rem;
        padding: 0 0.5rem;
        font-size: 0.7rem;
    }
}

@media (max-width: 900px) {
    .members {
        display: none;
    }
}
</style>
