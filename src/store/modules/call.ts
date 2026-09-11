import { defineStore } from 'pinia'
import type { Socket } from 'socket.io-client'
import { useSocketStore } from './socket'

// 通话状态：idle-空闲 calling-主叫振铃中 incoming-被叫来电中 active-通话中 failed-通话失败提示
export type CallStatus = 'idle' | 'calling' | 'incoming' | 'active' | 'failed'
type CallDirection = 'caller' | 'callee'

// STUN 服务器配置（局域网/本机可通过 host candidate 直连；跨公网通话需额外部署 TURN）
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// WebRTC 资源放在模块级，避免被 Pinia 状态代理
let pc: RTCPeerConnection | null = null
let localStream: MediaStream | null = null
// 远端描述到达前先到达的 ICE candidate 缓存队列
let pendingCandidates: RTCIceCandidateInit[] = []
let durationTimer: ReturnType<typeof setInterval> | null = null
let failTimer: ReturnType<typeof setTimeout> | null = null
let boundSocket: Socket | null = null

// 振铃提示音（Web Audio 合成，无需音频资源文件）
let ringCtx: AudioContext | null = null
let ringTimer: ReturnType<typeof setTimeout> | null = null
let ringMode: 'ringback' | 'ring' | null = null

interface CallPeer {
  id: string
  username: string
}

interface CallSignalPayload {
  callId: string
  from?: string
  username?: string
  to?: string
  reason?: string
  timestamp?: number
}

export const useCallStore = defineStore('call', {
  state: () => ({
    status: 'idle' as CallStatus,
    direction: null as CallDirection | null,
    callId: '',
    peerId: '',
    peerName: '',
    muted: false,
    // 通话时长（秒）
    duration: 0,
    // 失败/结束提示文案
    errorMsg: '',
    // 远端音频流
    remoteStream: null as MediaStream | null,
  }),
  getters: {
    // 是否处于通话相关状态
    isBusy: (state) => state.status === 'calling' || state.status === 'incoming' || state.status === 'active',
  },
  actions: {
    /**
     * 绑定 socket 信令事件（由 socket store 初始化连接时调用）
     */
    register(socket: Socket) {
      if (boundSocket === socket) return
      boundSocket = socket

      // ---- 通话状态信令 ----
      socket.on('call:incoming', this.handleIncoming.bind(this))
      socket.on('call:ringing', this.handleRinging.bind(this))
      socket.on('call:accepted', this.handleAccepted.bind(this))
      socket.on('call:rejected', this.handleRejected.bind(this))
      socket.on('call:canceled', this.handleCanceled.bind(this))
      socket.on('call:timeout', this.handleTimeout.bind(this))
      socket.on('call:ended', this.handleEnded.bind(this))
      socket.on('call:error', this.handleCallError.bind(this))

      // ---- WebRTC 协商信令 ----
      socket.on('webrtc:offer', this.handleOffer.bind(this))
      socket.on('webrtc:answer', this.handleAnswer.bind(this))
      socket.on('webrtc:candidate', this.handleCandidate.bind(this))

      // 自身连接断开时静默复位
      socket.on('disconnect', () => {
        this.resetAll()
      })
    },

    /**
     * 发送信令到服务器
     */
    emit(event: string, payload: Record<string, unknown>) {
      const socket = useSocketStore().socket
      socket?.emit(event, payload)
    },

    /**
     * 主叫：拨打电话
     */
    async startCall(peer: CallPeer) {
      if (this.isBusy) return

      clearFailTimer()
      this.direction = 'caller'
      this.peerId = peer.id
      this.peerName = peer.username
      this.callId = ''
      this.muted = false
      this.duration = 0
      this.remoteStream = null
      this.status = 'calling'

      // 提前获取麦克风，接听后可立即建立媒体
      try {
        localStream = await this.getUserAudio()
      } catch (err) {
        console.error('getUserMedia failed:', err)
        this.fail('无法访问麦克风，请检查浏览器麦克风权限')
        return
      }

      this.emit('call:invite', { to: peer.id })
      playRing('ringback')
    },

    /**
     * 被叫：接听电话
     */
    async acceptCall() {
      if (this.status !== 'incoming') return
      stopRing()

      try {
        localStream = await this.getUserAudio()
      } catch (err) {
        console.error('getUserMedia failed:', err)
        this.emit('call:reject', { callId: this.callId })
        this.fail('无法访问麦克风，已拒绝通话')
        return
      }

      // 先创建 PeerConnection 等待 Offer（Offer 到达时复用，不重复创建）
      this.createPeerConnection()
      this.emit('call:accept', { callId: this.callId })
      this.status = 'active'
      this.startDuration()
    },

    /**
     * 被叫：拒绝来电
     */
    rejectCall() {
      if (this.status !== 'incoming') return
      this.emit('call:reject', { callId: this.callId })
      this.resetAll()
    },

    /**
     * 挂断：振铃中主叫取消，通话中任意一方结束
     */
    hangup() {
      if (this.status === 'calling') {
        this.emit('call:cancel', { callId: this.callId })
      } else if (this.status === 'active') {
        this.emit('call:end', { callId: this.callId })
      }
      this.resetAll()
    },

    /**
     * 静音/取消静音
     */
    toggleMute() {
      if (!localStream) return
      this.muted = !this.muted
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.muted
      })
    },

    // ===================== 信令事件处理 =====================

    handleRinging(data: CallSignalPayload) {
      // 记录服务端生成的 callId，供振铃阶段取消通话使用
      this.callId = data.callId
    },

    handleIncoming(data: CallSignalPayload) {
      // 忙线时自动拒绝（服务端已有忙线校验，此处兜底）
      if (this.isBusy) {
        this.emit('call:reject', { callId: data.callId })
        return
      }
      this.direction = 'callee'
      this.callId = data.callId as string
      this.peerId = data.from as string
      this.peerName = data.username || '未知用户'
      this.muted = false
      this.duration = 0
      this.remoteStream = null
      this.status = 'incoming'
      playRing('ring')
    },

    async handleAccepted(data: CallSignalPayload) {
      if (this.status !== 'calling' || this.direction !== 'caller') return
      stopRing()
      this.callId = data.callId
      this.status = 'active'
      this.startDuration()

      // 主叫创建 PeerConnection 并发起 Offer 协商
      this.createPeerConnection()
      try {
        const offer = await pc!.createOffer({ offerToReceiveAudio: true })
        await pc!.setLocalDescription(offer)
        this.emit('webrtc:offer', { callId: this.callId, sdp: offer })
      } catch (err) {
        console.error('createOffer failed:', err)
        this.emit('call:end', { callId: this.callId })
        this.fail('建立通话连接失败')
      }
    },

    async handleOffer(data: CallSignalPayload & { sdp: RTCSessionDescriptionInit }) {
      if (this.status !== 'active' || this.direction !== 'callee') return
      if (!pc) {
        console.warn('PeerConnection not ready, ignore offer')
        return
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        await this.flushPendingCandidates()
        const answer = await pc.createAnswer({ offerToReceiveAudio: true })
        await pc.setLocalDescription(answer)
        this.emit('webrtc:answer', { callId: this.callId, sdp: answer })
      } catch (err) {
        console.error('handleOffer failed:', err)
        this.emit('call:end', { callId: this.callId })
        this.fail('建立通话连接失败')
      }
    },

    async handleAnswer(data: CallSignalPayload & { sdp: RTCSessionDescriptionInit }) {
      if (!pc || this.direction !== 'caller') return
      // 重复/乱序 Answer 防护：只有 have-local-offer 状态才能设置远端 Answer
      if (pc.signalingState !== 'have-local-offer') {
        console.warn(`ignore answer in signalingState: ${pc.signalingState}`)
        return
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        await this.flushPendingCandidates()
      } catch (err) {
        console.error('handleAnswer failed:', err)
      }
    },

    async handleCandidate(data: CallSignalPayload & { candidate: RTCIceCandidateInit }) {
      if (!pc || data.from !== this.peerId) return
      try {
        // 远端描述未设置前先缓存 candidate
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        } else {
          pendingCandidates.push(data.candidate)
        }
      } catch (err) {
        console.error('addIceCandidate failed:', err)
      }
    },

    handleRejected() {
      this.fail('对方已拒绝通话')
    },

    handleCanceled(data: CallSignalPayload) {
      // 被叫侧振铃超时只静默关闭弹窗，主叫侧取消提示
      if (this.direction === 'callee') {
        this.resetAll()
        return
      }
      this.fail(data.reason === 'timeout' ? '无人接听，通话已取消' : '对方已取消通话')
    },

    handleTimeout() {
      this.fail('无人接听，请稍后再拨')
    },

    handleEnded(data: CallSignalPayload) {
      this.fail(data.reason === 'offline' ? '对方已掉线，通话结束' : '对方已挂断，通话结束')
    },

    handleCallError(data: CallSignalPayload) {
      const reasonMap: Record<string, string> = {
        offline: '对方不在线',
        busy: '对方正在通话中',
        'busy-self': '您当前已有通话进行中',
        invalid: '通话参数错误',
        unavailable: '对方暂时无法接听',
      }
      this.fail(reasonMap[data.reason || ''] || '通话连接失败')
    },

    // ===================== WebRTC 内部方法 =====================

    async getUserAudio(): Promise<MediaStream> {
      return navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
    },

    createPeerConnection() {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' })
      pendingCandidates = []

      // 本地媒体轨道加入协商
      localStream?.getTracks().forEach((track) => {
        pc!.addTrack(track, localStream!)
      })

      // 上报本地 ICE candidate
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.emit('webrtc:candidate', { callId: this.callId, candidate: event.candidate })
        }
      }

      // 接收远端音频流
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0]
        }
      }

      // 连接状态监控
      pc.onconnectionstatechange = () => {
        const state = pc?.connectionState
        if (state === 'failed') {
          this.emit('call:end', { callId: this.callId })
          this.fail('网络连接失败，通话已结束')
        }
      }
    },

    async flushPendingCandidates() {
      if (!pc || pendingCandidates.length === 0) return
      const candidates = pendingCandidates
      pendingCandidates = []
      await Promise.all(
        candidates.map((candidate) => pc!.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
          console.error('flush candidate failed:', err)
        })),
      )
    },

    startDuration() {
      this.stopDuration()
      this.duration = 0
      durationTimer = setInterval(() => {
        this.duration += 1
      }, 1000)
    },

    stopDuration() {
      if (durationTimer) {
        clearInterval(durationTimer)
        durationTimer = null
      }
    },

    /**
     * 失败提示：释放资源并短暂展示原因后回到空闲
     */
    fail(message: string) {
      stopRing()
      closeMedia()
      closePeerConnection()
      this.stopDuration()
      this.errorMsg = message
      this.status = 'failed'
      clearFailTimer()
      failTimer = setTimeout(() => {
        this.resetAll()
      }, 2500)
    },

    /**
     * 静默释放全部通话资源并回到空闲
     */
    resetAll() {
      stopRing()
      closeMedia()
      closePeerConnection()
      this.stopDuration()
      this.status = 'idle'
      this.direction = null
      this.callId = ''
      this.peerId = ''
      this.peerName = ''
      this.muted = false
      this.duration = 0
      this.remoteStream = null
      this.errorMsg = ''
    },
  },
})

function closePeerConnection() {
  if (pc) {
    pc.onicecandidate = null
    pc.ontrack = null
    pc.onconnectionstatechange = null
    pc.close()
    pc = null
  }
  pendingCandidates = []
}

function closeMedia() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop())
    localStream = null
  }
}

function clearFailTimer() {
  if (failTimer) {
    clearTimeout(failTimer)
    failTimer = null
  }
}

/**
 * 播放振铃提示音
 * ringback-主叫等待音（嘟...嘟...） ring-被叫来电铃声
 */
function playRing(mode: 'ringback' | 'ring') {
  stopRing()
  ringMode = mode
  try {
    ringCtx = new AudioContext()
    ringCtx.resume?.()
    scheduleRing()
  } catch (err) {
    console.warn('AudioContext unavailable:', err)
    ringCtx = null
  }
}

function stopRing() {
  ringMode = null
  if (ringTimer) {
    clearTimeout(ringTimer)
    ringTimer = null
  }
  if (ringCtx) {
    ringCtx.close().catch(() => undefined)
    ringCtx = null
  }
}

function scheduleRing() {
  if (!ringCtx || !ringMode) return
  const now = ringCtx.currentTime

  if (ringMode === 'ringback') {
    // 主叫回铃音：1 秒 450Hz，周期 3 秒
    beep(ringCtx, now, 1, 450)
    ringTimer = setTimeout(scheduleRing, 3000)
  } else {
    // 被叫铃声：3 声短促高音，周期 1.8 秒
    beep(ringCtx, now, 0.25, 440)
    beep(ringCtx, now + 0.3, 0.25, 480)
    beep(ringCtx, now + 0.6, 0.25, 440)
    ringTimer = setTimeout(scheduleRing, 1800)
  }
}

function beep(ctx: AudioContext, start: number, duration: number, frequency: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.frequency.value = frequency
  oscillator.type = 'sine'
  // 简单包络，避免爆音
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
  gain.gain.setValueAtTime(0.2, start + duration - 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}
