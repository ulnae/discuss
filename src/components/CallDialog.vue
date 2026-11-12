<template>
  <!-- 远端语音播放（始终挂载，接通后绑定媒体流） -->
  <audio ref="audioRef" autoplay playsinline class="hidden"></audio>

  <!-- 通话失败/结束提示 -->
  <transition name="call-fade">
    <div v-if="callStore.status === 'failed'" class="call-toast">
      {{ callStore.errorMsg }}
    </div>
  </transition>

  <!-- 通话窗口 -->
  <transition name="call-pop">
    <div v-if="showCall" class="call-card">
      <!-- 头像与振铃动画 -->
      <div class="call-avatar-wrap">
        <span v-if="ringing" class="call-pulse" aria-hidden="true"></span>
        <div class="call-avatar" :class="{ 'is-active': callStore.status === 'active' }">
          {{ avatarText }}
        </div>
      </div>

      <!-- 对端信息 -->
      <div class="call-name">{{ callStore.peerName }}</div>
      <div class="call-status">{{ statusText }}</div>

      <!-- 操作按钮 -->
      <div class="call-actions">
        <!-- 来电：拒绝 / 接听 -->
        <template v-if="callStore.status === 'incoming'">
          <button type="button" class="call-btn call-btn-reject" title="拒绝" @click="callStore.rejectCall()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <button type="button" class="call-btn call-btn-accept" title="接听" @click="callStore.acceptCall()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
        </template>

        <!-- 通话中：静音切换 + 挂断 -->
        <template v-else-if="callStore.status === 'active'">
          <button type="button" class="call-btn call-btn-ghost" :class="{ 'is-on': callStore.muted }"
            :title="callStore.muted ? '取消静音' : '静音'" @click="callStore.toggleMute()">
            <svg v-if="!callStore.muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
              <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.5 4.5a2.25 2.25 0 0 0-2.644-2.216 2.25 2.25 0 0 0-1.844 2.09l.006.052c.07.602.164 1.38.236 2.098l3.23 3.231V8.03c0-.89-.066-1.78-.193-2.66a2.24 2.24 0 0 0-.79-1.36Z" />
              <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-3.53-3.53c.92-.67 1.53-1.47 1.9-2.29a.75.75 0 1 0-1.36-.63c-.31.67-.78 1.3-1.45 1.82l-1.55-1.55c.36-.34.68-.72.94-1.13a.75.75 0 0 0-1.31-.72c-.25.45-.56.84-.92 1.18l-1.5-1.5c.3-.28.58-.6.8-1a.75.75 0 0 0-1.31-.72c-.2.36-.44.67-.71.95L9.1 8.04c-.1-.74-.2-1.53-.3-2.26A3.752 3.752 0 0 1 13.4 2.1a.75.75 0 0 0-.27 1.47 2.25 2.25 0 0 1 .37.93ZM6.75 12.75v-.96c0-.45.1-.88.28-1.26l1.7 1.7v.52a3.75 3.75 0 0 0 5.83 3.12l1.1 1.1a5.25 5.25 0 0 1-8.16-3.77v-.45Z" />
            </svg>
          </button>
          <button type="button" class="call-btn call-btn-reject" title="挂断" @click="callStore.hangup()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </template>

        <!-- 主叫等待中：取消 -->
        <template v-else-if="callStore.status === 'calling'">
          <button type="button" class="call-btn call-btn-reject" title="取消" @click="callStore.hangup()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8"
              stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18 18 6M6 6l12 12" />
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
/* 通话提示条 */
.call-toast {
  position: fixed;
  top: 1.2rem;
  left: 50%;
  z-index: 9999;
  transform: translateX(-50%);
  padding: 0.55rem 0.95rem;
  border-radius: 10px;
  font-size: 0.8rem;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(16px);
}

/* 通话窗口：与登录卡片同源的玻璃质感 */
.call-card {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 288px;
  padding: 1.4rem 1.25rem 1.3rem;
  transform: translateX(-50%);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(18px) saturate(1.5);
  user-select: none;
}

.call-avatar-wrap {
  position: relative;
  width: 72px;
  height: 72px;
}

.call-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--success);
  opacity: 0.35;
  animation: call-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes call-ping {

  0% {
    transform: scale(1);
    opacity: 0.35;
  }

  75%,
  100% {
    transform: scale(1.45);
    opacity: 0;
  }
}

.call-avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent-fg);
  background: var(--accent);
  box-shadow: var(--shadow-accent);
}

.call-name {
  margin-top: 0.9rem;
  max-width: 100%;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-status {
  margin-top: 0.2rem;
  height: 1.1rem;
  font-size: 0.74rem;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.call-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.1rem;
  margin-top: 1.1rem;
  width: 100%;
}

.call-btn {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 15px;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, transform 0.12s ease, opacity 0.18s ease;
}

.call-btn:active {
  transform: scale(0.96);
}

.call-btn svg {
  width: 20px;
  height: 20px;
}

.call-btn-reject {
  color: #fff;
  background: #e11d48;
  box-shadow: 0 8px 20px -10px rgba(225, 29, 72, 0.7);
}

.call-btn-reject:hover {
  background: #be123c;
}

.call-btn-accept {
  color: var(--accent-fg);
  background: var(--accent);
  box-shadow: var(--shadow-accent);
}

.call-btn-accept:hover {
  background: var(--accent-hover);
}

.call-btn-ghost {
  color: var(--text);
  background: var(--surface-2);
  border-color: var(--border);
}

.call-btn-ghost:hover {
  background: var(--surface-3);
}

.call-btn-ghost.is-on {
  color: var(--accent-fg);
  background: var(--accent);
}

/* 进出场 */
.call-pop-enter-active,
.call-pop-leave-active {
  transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.call-pop-enter-from,
.call-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -14px) scale(0.97);
}

.call-fade-enter-active,
.call-fade-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.call-fade-enter-from,
.call-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@media (prefers-reduced-motion: reduce) {

  .call-pop-enter-active,
  .call-pop-leave-active,
  .call-fade-enter-active,
  .call-fade-leave-active {
    transition: none;
  }

  .call-pulse {
    animation: none;
  }
}
</style>
