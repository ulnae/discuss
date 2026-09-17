<template lang="">
  <div class="w-full h-full flex gap-2 overflow-hidden p-2">
      <div class="w-full h-full flex-1 flex flex-col gap-2">
          <div class="w-full text-center flex border-b border-gray-300 p-2 relative">
              <div class="flex-1 text-center animate__flipInX animate__animated">
                  {{ getRoomInfo.name }}
              </div>
                          
              <button class="cursor-pointer" @click="handleSwitchInfo">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
              </button>
          </div>

          <div class="w-full h-full flex-1 overflow-y-auto" id="messageContainer">
              <div v-for="message in getHistory" :key="message.id" class="w-full h-auto p-2 group"
                  :style="{ textAlign: message.sender === userStore.userInfo.id ? 'right' : 'left', }">
                  <div class="text-xs text-gray-700 py-1">
                    <span v-if="message.sender === userStore.userInfo.id" class="px-2">
                      <span class="hidden group-hover:inline-block" v-if="message.type">{{ formatFileSize(message.size) }}</span>
                      {{ dayjs(message.timestamp).fromNow() }}
                      [{{ userStore.userInfo.username }}]
                    </span>
                    <span v-if="message.sender !== userStore.userInfo.id" class="px-2">
                      [{{ getUserInfo(message.sender) }}]
                      {{ dayjs(message.timestamp).fromNow() }}
                      <span class="hidden group-hover:inline-block" v-if="message.type">{{ formatFileSize(message.size) }}</span>
                    </span>
                  </div>
                  <div class="flex mb-1 items-start">
                      <div class="flex-1">
                          <div class="inline-block bg-gray-200 p-2 py-1 rounded-md relative">
                              <Comment :message="message"/>

                              <!-- <div v-if="message.sender !== userStore.userInfo.id"
                                  class="absolute top-2 -left-2 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-gray-200 border-b-8 border-b-transparent">
                              </div>
                              <div v-else
                                  class="absolute top-2 -right-2 w-0 h-0 border-t-8 border-t-transparent border-l-8 border-l-gray-200 border-b-8 border-b-transparent">
                              </div> -->
                          </div>
                      </div>
                  </div>
                  
              </div>
          </div>
          <div ref="inputAreaRef" class="w-full h-60 border-t border-gray-300 p-4 relative">
              <textarea id="story" name="story" placeholder="请输入信息,回车发送..." v-enter="handleSend" v-model.trim="story" rows="5"
                  cols="33" class="w-full h-full "></textarea>
              <button class="absolute bottom-12 right-12 cursor-pointer" @click="handleSendImage">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                      stroke="currentColor" class="size-6">
                      <path stroke-linecap="round" stroke-linejoin="round"
                          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
              </button>

              <button class="absolute bottom-12 right-24 cursor-pointer" @click="handleSendFile">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
              </button>

          </div>
      </div>
      <div class="w-[200px] h-full border-l border-gray-300 flex flex-col gap-2 p-2 pt-0 overflow-hidden" v-show="infoVisiable">
          <div class="flex-1">
              <div class="border-b border-gray-300 p-2 pl-0 animate__flipInX animate__animated">群成员</div>
              <div v-for="member in getMember" :key="member.user_id"
                  class="group text-sm flex gap-1 items-center py-1" :class="{
                    'underline underline-offset-2': member.user_id === userStore.userInfo.id,
                    'text-green-700': getMemberOnline.has(member.user_id)
                  }">
                  <!-- 群主 -->
                  <svg v-if="getRoomInfo.creator === member.user_id" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                  </svg>

                  <!-- 成员 -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>

                  <span class="flex-1 gap-1 items-center truncate">{{ member.user_info.username }}</span>

                  <template v-if="getRoomInfo.creator !== member.user_id && roomStore.roomsMine.find((item: any) => item.id === route.params.id)">
                    <svg @click="handleRemoveMember(member.id)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 bg-gray-100 cursor-pointer hidden group-hover:block">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </template>
              </div>
          </div>
          <div class="flex-1" v-if="applyList.length > 0">
              <div class="border-b border-gray-300 pb-2">群申请</div>
              <div v-for="apply in applyList" class="text-sm flex justify-between items-center gap-2 py-1">
                  <span class="text-rose-400 flex-1 truncate">{{ apply.user_info.username }}</span>
                  <template v-if="apply.handle_status">
                      {{ apply.status ? '已同意' : '已拒绝' }}
                  </template>
<template v-else>
                    <button @click="handleHandleApply(apply, true)">同意</button>
                    <button @click="handleHandleApply(apply, false)">拒绝</button>
                  </template>
</div>
</div>
</div>
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
import { usePaste } from '@/hooks/paste'
import { useResizable } from '@/hooks/resizable'
import { Comment } from '@/components'


const socketStore = useSocketStore();
const userStore = useUserStore();
const roomStore = useRoomStore();
const story = ref("");
const inputAreaRef = ref<HTMLElement | null>(null);
useResizable(inputAreaRef, { direction: 'vertical', minSize: 180, maxSize: 600, initialSize: 240 });
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
// 无房间信息时，跳转404
watchEffect(() => {
  if (!getRoomInfo.value.id) router.push('404')
})

// 监听路由变化
const applyList = ref([]);
watch(
  () => route.params.id,
  (room_id) => {
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

const uploadImage = (file: Blob) => {
  const formData = new FormData();
  formData.append("file", file as Blob);
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
<style lang="">
</style>