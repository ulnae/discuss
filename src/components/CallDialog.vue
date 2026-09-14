<template lang="">
  <!-- 远端语音播放（始终挂载，接通后绑定媒体流） -->
  <audio ref="audioRef" autoplay playsinline class="hidden"></audio>

  <!-- 通话失败/结束提示 -->
  <transition name="call-fade">
    <div v-if="callStore.status === 'failed'"
      class="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
      {{ callStore.errorMsg }}
    </div>
  </transition>

  <!-- 通话窗口 -->
  <transition name="call-pop">
    <div v-if="showCall"
      class="fixed top-6 left-1/2 -translate-x-1/2 z-[9998] w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 flex flex-col items-center gap-3 select-none">

      <!-- 头像与振铃动画 -->
      <div class="relative w-20 h-20 mt-1">
        <span v-if="ringing"
          class="absolute inset-0 rounded-full bg-green-400 opacity-40 animate-ping"></span>
        <div class="relative w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center text-2xl font-semibold"
          :class="{ 'bg-gray-500': callStore.status === 'active' }">
          {{ avatarText }}
        </div>
      </div>

      <!-- 对端信息 -->
      <div class="text-base font-medium text-gray-800 truncate max-w-full">{{ callStore.peerName }}</div>
      <div class="text-xs text-gray-500 h-4">{{ statusText }}</div>

      <!-- 操作按钮 -->
      <div class="flex items-center justify-center gap-6 mt-2 w-full">
        <!-- 来电：拒绝 -->
        <template v-if="callStore.status === 'incoming'">
          <button @click="callStore.rejectCall()" title="拒绝"
            class="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>

          </button>
          <button @click="callStore.acceptCall()" title="接听"
            class="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
        </template>

        <!-- 通话中：静音切换 + 挂断 -->
        <template v-else-if="callStore.status === 'active'">
          <button @click="callStore.toggleMute()" :title="callStore.muted ? '取消静音' : '静音'"
            class="w-12 h-12 rounded-full text-white flex items-center justify-center transition-colors"
            :class="callStore.muted ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'">
            <svg v-if="!callStore.muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
              <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
              <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
              <path d="M13.5 4.5a2.25 2.25 0 0 0-2.644-2.216 2.25 2.25 0 0 0-1.844 2.09l.006.052c.07.602.164 1.38.236 2.098l3.23 3.231V8.03c0-.89-.066-1.78-.193-2.66a2.24 2.24 0 0 0-.79-1.36Z" />
              <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-3.53-3.53c.92-.67 1.53-1.47 1.9-2.29a.75.75 0 1 0-1.36-.63c-.31.67-.78 1.3-1.45 1.82l-1.55-1.55c.36-.34.68-.72.94-1.13a.75.75 0 0 0-1.31-.72c-.25.45-.56.84-.92 1.18l-1.5-1.5c.3-.28.58-.6.8-1a.75.75 0 0 0-1.31-.72c-.2.36-.44.67-.71.95L9.1 8.04c-.1-.74-.2-1.53-.3-2.26A3.752 3.752 0 0 1 13.4 2.1a.75.75 0 0 0-.27 1.47 2.25 2.25 0 0 1 .37.93ZM6.75 12.75v-.96c0-.45.1-.88.28-1.26l1.7 1.7v.52a3.75 3.75 0 0 0 5.83 3.12l1.1 1.1a5.25 5.25 0 0 1-8.16-3.77v-.45Z" />
            </svg>
          </button>
          <button @click="callStore.hangup()" title="挂断"
            class="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </template>

        <!-- 主叫等待中：取消 -->
        <template v-else-if="callStore.status === 'calling'">
          <button @click="callStore.hangup()" title="取消"
            class="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </template>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCallStore } from '@/store/modules/call'

const callStore = useCallStore()
const audioRef = ref<HTMLAudioElement | null>(null)

const showCall = computed(() =>
  callStore.status === 'calling' || callStore.status === 'incoming' || callStore.status === 'active',
)
const ringing = computed(() => callStore.status === 'calling' || callStore.status === 'incoming')
const avatarText = computed(() => callStore.peerName.charAt(0).toUpperCase() || '?')

const statusText = computed(() => {
  switch (callStore.status) {
    case 'incoming':
      return '邀请你进行语音通话'
    case 'calling':
      return '正在等待对方接听...'
    case 'active':
      return formatDuration(callStore.duration)
    default:
      return ''
  }
})

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = (seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

// 远端流到达后绑定到 audio 元素播放，通话结束时释放
watch(() => callStore.remoteStream, (stream) => {
  if (!audioRef.value) return
  if (stream) {
    audioRef.value.srcObject = stream
    audioRef.value.play().catch((err) => {
      console.warn('remote audio play failed:', err)
    })
  } else {
    audioRef.value.srcObject = null
  }
})
</script>

<style scoped>
.call-pop-enter-active,
.call-pop-leave-active {
  transition: all 0.25s ease;
}
.call-pop-enter-from,
.call-pop-leave-to {
  opacity: 0;
  transform: translate(0, -16px);
}

.call-fade-enter-active,
.call-fade-leave-active {
  transition: all 0.25s ease;
}
.call-fade-enter-from,
.call-fade-leave-to {
  opacity: 0;
  transform: translate(0, -8px);
}
</style>
