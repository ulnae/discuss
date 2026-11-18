<script setup lang="ts">
import { useUserStore } from '@/store/modules/user'
import { CallDialog } from '@/components'
import ToastHost from '@/components/ui/toast/ToastHost.vue'
import { useTheme } from '@/hooks/theme'
useTheme()

const userStore = useUserStore()
userStore.init()

// 聊天记录 / 系统广播的本地持久化统一由 store/modules/socket.ts 与
// utils/messageCache.ts 负责（收到消息时防抖写盘、启动时恢复），
// 不再在这里用 deep watch 往旧 database store 写整张 Map。
</script>

<template>
  <router-view></router-view>
  <!-- 全局语音通话弹窗（来电/拨打/通话中） -->
  <CallDialog />
  <!-- 全局轻提示：右上角小窗，3 秒后自动消失 -->
  <ToastHost />
</template>

<style scoped></style>
