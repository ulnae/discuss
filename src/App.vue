<script setup lang="ts">
import { useUserStore } from '@/store/modules/user'
import { useDBStore } from '@/store/modules/database'
import { useSocketStore } from '@/store/modules/socket'
import { useAlertStore } from '@/store/modules/alert'
import { debounce, cloneDeep } from 'lodash-es'
import { watch, onUnmounted } from 'vue'
import CallDialog from '@/components/CallDialog.vue'

// Notification.requestPermission().then(permission => {
//   if (permission === 'granted') {
//     new Notification('标题', { body: '通知已授权' });
//   }
// });

const userStore = useUserStore()
const dbStore = useDBStore()
const socketStore = useSocketStore()
const alertStore = useAlertStore()

userStore.init()

// 监听整个 store 的变化
// const unsubscribe = socketStore.$subscribe((mutation, state) => {
//   console.log('mutation', mutation,state)
//   if (mutation.type === 'direct' && mutation.events?.key === 'userMessageMap') {
//     console.log('userMessageMap 变化了:', state.userMessageMap)
//   }
// }) // detached: true 表示组件卸载后继续监听
// 在组件卸载时取消订阅（可选）
onUnmounted(() => {
  // unsubscribe()
})
watch(() => [socketStore.userMessageMap], debounce(([newUserMessageMap]) => {
  dbStore.database?.setItem('User_Message', cloneDeep(newUserMessageMap))
}, 1000), { deep: true })

watch(() => [socketStore.roomMessageMap], debounce(([newRoomMessageMap]) => {
  dbStore.database?.setItem('Room_Message', cloneDeep(newRoomMessageMap))
}, 1000), { deep: true })

watch(() => [alertStore.alerts], debounce(([newAlerts]) => {
  dbStore.database?.setItem('Alert_Message', cloneDeep(newAlerts))
}, 1000), { deep: true })
</script>

<template>
  <router-view></router-view>
  <!-- 全局语音通话弹窗（来电/拨打/通话中） -->
  <CallDialog />
</template>

<style scoped></style>
