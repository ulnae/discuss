<template>
  <div class="chat-shell">
    <div class="chat-main">
      <header class="chat-head">
        <button type="button" class="icon-btn back-btn" title="返回房间列表" @click="goBack">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div class="chat-head-main">
          <div class="chat-title">{{ getRoomInfo.name || (roomStore.loading ? '加载中…' : '未知房间') }}</div>
          <div class="chat-sub" :title="getRoomInfo.description">
            {{ getRoomInfo.description || (roomStore.loading ? '' : '这个房间还没有描述') }}
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

      <div id="messageContainer" ref="containerRef" class="chat-body">
        <div class="msg-list">
          <!-- 房间信息 / 成员（overview）在途：展示 loading；本地已有消息缓存则不打扰 -->
          <div v-if="roomStore.loading && !getHistory.length" class="list-loading">
            <span class="loading-spinner"></span>
            正在加载…
          </div>
          <div v-else-if="!getHistory.length" class="empty">
            <span class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M20.25 8.5c.9.3 1.5 1.1 1.5 2.1v4.3c0 1.1-.8 2.1-2 2.2l-1 .1v3l-3-3c-1.4 0-2.7-.1-4-.2" />
                <path d="M16.5 6.6c0-1.6-1.2-3-2.8-3.2A48 48 0 0 0 5 3.4C3.4 3.6 2.2 5 2.2 6.6v6.2c0 1.6 1.2 3 2.8 3.2L7 16.2V21l4.2-4.2" />
              </svg>
            </span>
            群里还很安静，说点什么吧
          </div>

          <div v-for="message in visibleMessages" :key="message.id" class="msg"
            :class="{ 'is-me': message.from === userStore.userInfo.id }">
            <div class="msg-meta">
              <span>{{ message.from === userStore.userInfo.id ? userStore.userInfo.username : getUserInfo(message.from) }}</span>
              <span>{{ dayjs(message.timestamp).fromNow() }}</span>
              <span v-if="message.type">{{ formatFileSize(message.size) }}</span>
            </div>
            <div class="bubble">
              <Comment :message="message" @resend="handleResend(message)" />
            </div>
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

    <div v-show="infoVisiable" class="members-mask" @click="infoVisiable = false"></div>

    <aside v-show="infoVisiable" class="members">
      <section class="members-block">
        <header class="members-head">
          <span>
            群成员
            <span class="chip">{{ memberLoading ? '…' : getMember.length }}</span>
          </span>
          <button type="button" class="icon-btn members-close" title="关闭" @click="infoVisiable = false">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div class="member-list">
          <!-- 成员名单随房间信息一起加载：在途时用 loading 占位，避免先闪出 0 人空列表 -->
          <div v-if="memberLoading" class="list-loading panel-loading">
            <span class="loading-spinner"></span>
            正在加载群成员…
          </div>
          <TransitionGroup v-else name="member" tag="div" class="member-rows" :key="String(route.params.id)">
          <div v-for="member in sortedMember" :key="member.user_id" class="member-row"
            :class="{ 'is-me': member.user_id === userStore.userInfo.id, 'is-online': getMemberOnline.has(member.user_id) }">
            <span class="avatar">{{ (member.user_info.username || '?').charAt(0).toUpperCase() }}</span>
            <span class="row-main">
              <span class="row-name">{{ member.user_info.username }}</span>
            </span>
            <span class="owner-badge" v-if="getRoomInfo.creator === member.user_id">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M3 6.5l4.5 3.5L12 4l4.5 6L21 6.5 19 18H5L3 6.5z" />
              </svg>
              群主
            </span>
            <span class="dot" :class="{ 'dot-online': getMemberOnline.has(member.user_id) }"></span>
            <button v-if="getRoomInfo.creator !== member.user_id && roomStore.isOwnerOf(route.params.id as string)"
              type="button" class="icon-btn kick" title="移出群聊" @click="handleRemoveMember(member.id)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
                stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          </TransitionGroup>
        </div>
      </section>

      <button v-if="!memberLoading" type="button" class="btn btn-ghost btn-block btn-sm danger-btn leave-room-btn" @click="handleLeaveRoom">
        {{ isOwner ? '解散房间' : '退出房间' }}
      </button>
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

import { computed, onMounted } from "vue";
import ServerApi from "@/api";
import dayjs from "@/plugin/dayjs";
import serverApi from "@/api";
import { vEnter } from "@/directives/vEnter";
import { formatFileSize } from "@/utils";
import { compressImage, imageFilename } from "@/utils/image";
import { usePaste } from '@/hooks/paste'
import { useResizable } from '@/hooks/resizable'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { Comment } from '@/components'
import { toast } from '@/components/ui/toast'

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

// 聊天区只渲染最近 50 条，避免长会话 DOM 堆积；上滑到顶 / 点击顶部按钮再加载 50 条
const visibleCount = ref(50)
const visibleMessages = computed(() => getHistory.value.slice(-visibleCount.value))
const hasEarlierMessages = computed(() => getHistory.value.length > visibleCount.value)

// 聊天区自动滚动：新消息显式跟随 + 上滑到顶加载更早消息（并做视觉锚定）
const containerRef = ref<HTMLElement | null>(null);
const { pinToBottom } = useAutoScroll(containerRef, {
  lastMessageKey: () => getHistory.value[getHistory.value.length - 1]?.id,
  hasEarlier: () => hasEarlierMessages.value,
  loadEarlier: () => { visibleCount.value += 50 },
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
// 获取用户信息
const getUserInfo = (user_id: string) => {
  return getMember.value.find((item: any) => item.user_id === user_id)
    ?.user_info?.username;
};
// 获取房间信息
const getRoomInfo = computed(() => {
  return roomStore.getRoomMap[route.params.id as string]?.room_info || {};
});
// 房间列表已加载但找不到该房间（被踢 / 被解散）时回房间列表，而不是甩一个 404
watchEffect(() => {
  if (!roomStore.rooms.length) return
  if (!getRoomInfo.value.id) router.replace('/room/dashboard')
})

// 发送消息（走 store 乐观发送：先上屏，回执后对账）
const handleSend = () => {
  if (!story.value) return;
  socketStore.sendRoom(route.params.id as string, story.value);
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
      socketStore.sendRoom(route.params.id as string, `/${res.data.path}`, {
        type: "image",
        size: res.data.size,
      });
    }
  }).catch(() => { /* 失败提示由 axios 拦截器统一弹出 */ });
}

const uploadFile = (file: Blob) => {
  const formData = new FormData();
  formData.append("file", file as Blob);
  serverApi.UploadUser(formData).then((res: any) => {
    if (res.code === 200) {
      socketStore.sendRoom(route.params.id as string, `/${res.data.path}`, {
        type: "file",
        size: res.data.size,
        originalname: res.data.originalname,
      });
    }
  }).catch(() => { /* 失败提示由 axios 拦截器统一弹出 */ });
}
onMounted(() => {
  document.getElementById("chooseImage")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadImage(file)
    // 清空 value：否则连续选择同一个文件不会触发 change
    ;(e.target as HTMLInputElement).value = ''
  });
  document.getElementById("chooseFile")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadFile(file)
    ;(e.target as HTMLInputElement).value = ''
  });
  // 首次滚动由 useAutoScroll 在 onMounted 内完成（含 hydrate / 图片加载的后续补滚）
});

// 快捷上传图片及文件
usePaste(uploadImage, uploadFile)

// 换房间时把「已展开的条数」收回去，并强制回到贴底状态
watch(
  () => route.params.id,
  () => { visibleCount.value = 50; pinToBottom() }
)

const infoVisiable = ref(!isNarrow())
const handleSwitchInfo = () => {
  infoVisiable.value = !infoVisiable.value
}

/** 窄屏默认收起群成员面板，点右上角以抽屉形式查看 */
function isNarrow() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
}

const goBack = () => router.push('/room/dashboard')

// 群主：可解散房间、移出成员；其他人只能自己退出
const isOwner = computed(() => !!getRoomInfo.value.creator && getRoomInfo.value.creator === userStore.userInfo.id)

async function handleLeaveRoom() {
  const roomId = route.params.id as string
  const name = getRoomInfo.value.name || '房间'

  if (isOwner.value) {
    if (!window.confirm(`解散后所有成员都会被移出，确定解散「${name}」吗？`)) return
    const res: any = await ServerApi.DeleteRoom(roomId)
    if (res.code === 200) {
      roomStore.removeRoom(roomId)
      toast.success('房间已解散')
      router.replace('/room/dashboard')
    }
    return
  }

  const self = getMember.value.find((item: any) => item.user_id === userStore.userInfo.id)
  if (!self) {
    toast.warning('你已不在该房间')
    router.replace('/room/dashboard')
    return
  }
  if (!window.confirm(`确定退出「${name}」吗？`)) return

  const res: any = await ServerApi.RemoveMember(self.id)
  if (res.code === 200) {
    roomStore.removeRoom(roomId)
    toast.info('已退出房间')
    router.replace('/room/dashboard')
  }
}

function handleRemoveMember(id: string) {
  if (!window.confirm('确定把该成员移出房间吗？对方会立刻收到通知')) return
  ServerApi.RemoveMember(id).then((res: any) => {
    if (res.code === 200) {
      roomStore.getRoomMember(route.params.id as string);
      toast.success('已移出成员')
    }
  });
}
</script>

<style lang="scss" scoped>
/* 顶部群标题区与左侧搜索区（.side-head）整体同高：
   padding 节奏一致（0.7rem / 0.6rem），标题 + 群描述压进一行内容高度内 */
.chat-head {
    padding-top: 0.7rem;
    padding-bottom: 0.6rem;
}

.chat-title {
    line-height: 1.15;
}

/* 群描述作为标题副行，单行展示，超长省略 */
.chat-sub {
    display: block;
    line-height: 1.2;
    /* loading 时副行为空字符串，锁住一行高度，避免加载完成瞬间标题整体跳动 */
    min-height: 1.2em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

/* 退出 / 解散按钮贴在侧边栏底部，样式同好友资料里的删除好友 */
.leave-room-btn {
    margin-top: auto;
}

.members-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-2);
}

/* 抽屉关闭按钮：窄屏抽屉形态下必须可见，否则关不掉 */
.members-close {
    width: 26px;
    height: 26px;
    border-radius: 8px;

    svg {
        width: 14px;
        height: 14px;
    }
}

/* 群成员面板内的 loading 占位：比通用列表更紧凑 */
.panel-loading {
    padding: 2rem 0.5rem;
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

.member-row .avatar {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    font-size: 0.68rem;
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

/* 移动端：群成员面板改成右侧抽屉 */
.members-mask {
    display: none;
}

@media (max-width: 900px) {
    .chat-shell {
        position: relative;
    }

    .members {
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

    .members-mask {
        /* 基础样式是 display:none，这里必须恢复显示，否则遮罩永远不出现、抽屉关不掉 */
        display: block;
        position: absolute;
        inset: 0;
        z-index: 25;
        background: var(--mask-bg);
        backdrop-filter: blur(1px);
    }

    /* 触摸设备没有 hover，踢人按钮常显 */
    .kick {
        opacity: 0.7;
    }
}
</style>
