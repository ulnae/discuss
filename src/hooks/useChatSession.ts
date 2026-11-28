import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { ChatMessage, MentionRef } from '@/constants/events'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { usePaste } from '@/hooks/usePaste'
import { useFilePicker } from '@/hooks/useFilePicker'
import serverApi from '@/api'
import { i18n } from '@/locales'
import { compressImage, imageFilename } from '@/utils/image'
import { useMdPreference } from '@/hooks/useMdPreference'
import { useSocketStore } from '@/store/modules/socket'
import { toast } from '@/components/ui/toast'

export interface ChatMessageMeta {
  type?: string
  size?: number
  originalname?: string
  /** 群聊 @ 成员（私聊不传），随 meta 透传并落本地缓存 */
  mentions?: MentionRef[]
}

interface UseChatSessionOptions {
  history: ComputedRef<ChatMessage[]>
  send: (content: string, meta?: ChatMessageMeta) => void
  resend: (message: ChatMessage) => void
  /** 当前会话目标 id（私聊对方 / 房间 id），用于上传占位消息归位 */
  target?: () => string
  /** 是否群聊：决定占位消息写入哪个 Map */
  isRoom?: boolean
}

/** 同时上传的文件上限，避免粘贴一批图时发出过多并发请求 */
const UPLOAD_LIMIT = 3

/** 窄屏面板断点：与 design.scss 的 900px 抽屉媒体查询保持一致 */
const isNarrow = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches

/**
 * 私聊/群聊共用的会话逻辑：可见窗口、自动滚动、发送/重发、
 * 图片/文件上传、粘贴上传、切会话复位、详情面板开关。
 */
export function useChatSession(options: UseChatSessionOptions) {
  const route = useRoute()
  const { mdInputEnabled } = useMdPreference()

  const story = ref('')

  const visibleCount = ref(50)
  const visibleMessages = computed(() => options.history.value.slice(-visibleCount.value))
  const hasEarlierMessages = computed(() => options.history.value.length > visibleCount.value)

  const containerRef: Ref<HTMLElement | null> = ref(null)
  const { pinToBottom } = useAutoScroll(containerRef, {
    lastMessageKey: () => options.history.value[options.history.value.length - 1]?.id,
    hasEarlier: () => hasEarlierMessages.value,
    loadEarlier: () => { visibleCount.value += 50 }
  })

  const handleSend = (mentions: MentionRef[] = []) => {
    if (!story.value) return
    options.send(story.value, mentions.length ? { mentions } : undefined)
    story.value = ''
  }

  const handleResend = (message: ChatMessage) => options.resend(message)

  /** Windows 下 multer 返回的 path 含反斜杠（public\1001\x.png），统一归一为正斜杠 */
  const normalizePath = (raw: unknown) => String(raw ?? '').replace(/\\/g, '/')

  /** Markdown 编辑模式：把上传结果以 Markdown 片段插入输入框正文，可与文字混排 */
  const insertIntoStory = (snippet: string) => {
    story.value = story.value ? `${story.value}\n${snippet}` : snippet
  }

  /** 并发上传计数：控制按钮禁用与限流 */
  const uploadingCount = ref(0)
  const uploadLimit = UPLOAD_LIMIT

  /**
   * 上传统一流程：限流 → （直接发送模式）插入 uploading 占位 → HTTP 上传
   * → 成功时占位消息原地转 sending 并 emit / Markdown 模式插入输入框 → 失败转 failed。
   */
  const runUpload = async (
    buildForm: () => Promise<FormData> | FormData,
    placeholderMeta: ChatMessageMeta,
    onSuccess: (path: string, data: any) => { content: string; meta: ChatMessageMeta } | void
  ) => {
    if (uploadingCount.value >= UPLOAD_LIMIT) {
      toast.warning(i18n.global.t('chat.uploadLimit', { count: UPLOAD_LIMIT }))
      return
    }
    uploadingCount.value += 1
    const socketStore = useSocketStore()
    const isRoom = !!options.isRoom
    const target = options.target ? options.target() : ''
    // Markdown 模式只插入输入框、不直接发消息，无需占位消息
    const clientId = !mdInputEnabled.value && target
      ? socketStore.addUploadingMessage(isRoom, target, placeholderMeta)
      : null

    try {
      const formData = await buildForm()
      const res: any = await serverApi.UploadUser(formData)
      if (res.code !== 200) return
      const path = `/${normalizePath(res.data.path)}`
      const result = onSuccess(path, res.data)
      if (mdInputEnabled.value || !result) return
      if (clientId) {
        socketStore.replaceUploadWithSend(isRoom, target!, clientId, result.content, result.meta)
      } else {
        options.send(result.content, result.meta)
      }
    } catch {
      // 错误提示由 axios 拦截器统一弹出
      if (clientId) socketStore.failUploadingMessage(isRoom, target!, clientId)
    } finally {
      uploadingCount.value = Math.max(0, uploadingCount.value - 1)
    }
  }

  const uploadImage = (file: Blob) => runUpload(
    async () => {
      const blob = await compressImage(file)
      const formData = new FormData()
      formData.append('file', blob, imageFilename(blob))
      return formData
    },
    { type: 'image', originalname: (file as File).name || i18n.global.t('chat.imgBroken') },
    (path, data) => {
      if (mdInputEnabled.value) {
        insertIntoStory(`![](${path})`)
        return
      }
      return { content: path, meta: { type: 'image', size: data.size } }
    }
  )

  const uploadFile = (file: Blob) => runUpload(
    () => {
      const formData = new FormData()
      formData.append('file', file)
      return formData
    },
    { type: 'file', originalname: (file as File).name || i18n.global.t('chat.file') },
    (path, data) => {
      const originalname = data.originalname || (file as File).name || ''
      if (mdInputEnabled.value) {
        insertIntoStory(`[${originalname || i18n.global.t('chat.file')}](${path})`)
        return
      }
      return { content: path, meta: { type: 'file', size: data.size, originalname } }
    }
  )

  const handleSendImage = () => document.getElementById('chooseImage')?.click()
  const handleSendFile = () => document.getElementById('chooseFile')?.click()

  useFilePicker('chooseImage', uploadImage)
  useFilePicker('chooseFile', uploadFile)
  usePaste(uploadImage, uploadFile)

  watch(() => route.params.id, () => {
    visibleCount.value = 50
    pinToBottom()
  })

  const infoVisiable = ref(!isNarrow())
  const handleSwitchInfo = () => { infoVisiable.value = !infoVisiable.value }

  return {
    story,
    containerRef,
    visibleMessages,
    hasEarlierMessages,
    handleSend,
    handleResend,
    handleSendImage,
    handleSendFile,
    uploadImage,
    uploadFile,
    infoVisiable,
    handleSwitchInfo,
    pinToBottom,
    uploadingCount,
    uploadLimit
  }
}
