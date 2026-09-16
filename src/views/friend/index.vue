<!--
 * @Author       : Eug yyh3531@163.com
 * @Date         : 2025-11-23 20:37:33
 * @LastEditors  : Eug yyh3531@163.com
 * @LastEditTime : 2025-11-23 23:36:26
 * @FilePath     : \e-talk\src\views\friend\index.vue
 * @Description  : filename
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
-->
<template lang="">
  <div class="w-full h-full flex gap-2 p-2">
    <div class="w-full h-full flex flex-col gap-2">
        <div class="w-full text-center flex border-b border-gray-300 p-2 relative">
            <div class="flex-1 text-center animate__flipInX animate__animated">
              {{ getFriendInfo.username }}
            </div>

            <button class="cursor-pointer" @click="handleSwitchInfo">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </button>
        </div>
        <div class="w-full h-full flex-1 overflow-y-auto relative" id="messageContainer">
           <div v-for="message in getHistory" :key="message.id" class="w-full h-auto p-2 group" :style="{
            textAlign: message.sender === route.params.id ? 'left' : 'right',
           }">
            <div class="mb-1 ">
              <div class="text-xs text-gray-700 py-1" >
                <span v-if="message.type && message.sender !== route.params.id" class="px-2 hidden group-hover:inline-block">
                  {{ formatFileSize(message.size) }}
                </span>
                {{ dayjs(message.timestamp).fromNow() }}
                <span v-if="message.type && message.sender === route.params.id" class="px-2 hidden group-hover:inline-block">
                  {{ formatFileSize(message.size) }}
                </span>
              </div>
              <div class="inline-block bg-gray-200 p-2 py-1 rounded-md relative">
                <Comment :message="message"/>

                <!-- <div v-if="message.sender === route.params.id" class="absolute top-2 -left-2 w-0 h-0 
                  border-t-8 border-t-transparent
                  border-r-8 border-r-gray-200
                  border-b-8 border-b-transparent">
                </div>

                <div v-else class="absolute top-2 -right-2 w-0 h-0 
                  border-t-8 border-t-transparent
                  border-l-8 border-l-gray-200
                  border-b-8 border-b-transparent">
                </div> -->
              </div>
            </div>

           </div>
        </div>
        <div class="w-full h-60 border-t border-gray-300 p-4 relative">
            <textarea id="story" name="story" placeholder="请输入信息,回车发送..." v-enter="handleSend" v-model.trim="story" rows="5" cols="33" class="w-full h-full  ">
            </textarea>
            <div class="absolute bottom-12 right-12 flex gap-6">
              <button class="cursor-pointer"
                title="语音通话" @click="handleStartCall">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </button>
              <button class="cursor-pointer" @click="handleSendImage">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </button>
              <button class="cursor-pointer" @click="handleSendFile">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
              </button>
            </div>

        </div>
    </div>
    <div class="w-[200px] h-full border-l border-gray-300 flex flex-col gap-2 p-2 pt-0 overflow-hidden" v-show="infoVisiable">
      <div class="border-b border-gray-300 p-2 pl-0 animate__flipInX animate__animated">
        <!-- <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg> -->
        用户信息
      </div>
      <div class="text-sm  flex justify-between" >
        

        <span class="flex gap-1 items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <span class="truncate flex-1">{{ getFriendInfo.username }}</span>
        </span>
      </div>
      <div class="text-sm flex gap-1 items-center" >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        {{ dayjs(getFriendInfo.createdAt).format('YYYY/MM/DD') }}
      </div>
      <div class="text-sm flex gap-1 items-center" >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V8.844a2.25 2.25 0 0 1 1.183-1.981l7.5-4.039a2.25 2.25 0 0 1 2.134 0l7.5 4.039a2.25 2.25 0 0 1 1.183 1.98V19.5Z" />
        </svg>
        <span class="truncate flex-1">{{ getFriendInfo.email }}</span>
      </div>
    </div>

    <input class="hidden" id="chooseImage" type="file" accept="image/*">
    <input class="hidden" id="chooseFile" type="file" accept="*">

  </div>
</template>
<script setup lang="ts">
import { useSocketStore } from "@/store/modules/socket";
import { useFriendStore } from "@/store/modules/friend";
import { useCallStore } from "@/store/modules/call";
import { computed, onMounted, ref, nextTick, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Socket } from "socket.io-client";
import dayjs from "@/plugin/dayjs";
import serverApi from "@/api";
import { vEnter } from "@/directives/vEnter";
import { formatFileSize, scrollToBottom } from "@/utils";
import { usePaste } from "@/hooks/paste";
import { Comment } from "@/components";

const socketStore = useSocketStore();
const friendStore = useFriendStore();
const callStore = useCallStore();

const story = ref("");
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

// 发起语音通话
const handleStartCall = () => {
  if (!isFriendOnline.value || callStore.isBusy) return;
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

const uploadImage = (file: Blob) => {
  const formData = new FormData();
  formData.append("file", file as Blob);
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
<style lang="">
</style>