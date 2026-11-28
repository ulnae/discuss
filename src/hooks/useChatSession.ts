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

  const handleResend = (message: ChatMessage) => {
    // 上传失败的占位消息内容只是本地文件名，必须重新上传原始文件，
    // 绝不能走普通重发把文件名当正文发给对方。
    if ((message as any).uploadFailed) {
      retryUpload(message)
      return
    }
    options.resend(message)
  }

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
   * 失败上传的原始任务：只保留在内存，不落盘。
   * 上传失败后气泡点「重试」要重新走 HTTP 上传；绝不能走 resendMessage
   * 把占位消息里的本地文件名当成正文 emit 出去。刷新后这张表自然清空，
   * 此时重试会提示用户重新选择文件。
   */
  const uploadTasks = new Map<string, () => Promise<void>>()

  /**
   * 上传统一流程：限流 →（直接发送模式）插入 uploading 占位 → HTTP 上传
   * → 成功时占位消息原地转 sending 并 emit / Markdown 模式插入输入框 → 失败转 failed。
   */
  const runUpload = async (
    blob: Blob,
    buildForm: () => Promise<FormData> | FormData,
    placeholderMeta: ChatMessageMeta,
    onSuccess: (path: string, data: any, markdownMode: boolean) => { content: string; meta: ChatMessageMeta } | void
  ) => {
    if (uploadingCount.value >= UPLOAD_LIMIT) {
      toast.warning(i18n.global.t('chat.uploadLimit', { count: UPLOAD_LIMIT }))
      return
    }
    uploadingCount.value += 1
    const socketStore = useSocketStore()
    const isRoom = !!options.isRoom
    const target = options.target ? options.target() : ''
    // 锁定本次上传开始时的模式：过程中切换 Markdown 开关不能改变已建占位/待发路径，
    // 否则会出现「开始按非 md 建了占位、结束时按 md 不发消息」导致占位永久卡住。
    const markdownMode = mdInputEnabled.value
    const clientId = !markdownMode && target
      ? socketStore.addUploadingMessage(isRoom, target, placeholderMeta)
      : null
    let succeeded = false

    try {
      const formData = await buildForm()
      const res: any = await serverApi.UploadUser(formData)
      // 非 200 通常由 axios 拦截器抛错走到 catch；但 code=0 等分支会直接返回
      // dataAxios.data（没有 code 字段）而不抛错，这里必须自己收尾，
      // 否则占位消息永远停在 uploading。
      if (res?.code !== 200) {
        if (clientId) socketStore.failUploadingMessage(isRoom, target!, clientId)
        return
      }
      const path = `/${normalizePath(res.data.path)}`
      const result = onSuccess(path, res.data, markdownMode)
      if (markdownMode) { succeeded = true; return }
      if (!result) {
        if (clientId) socketStore.failUploadingMessage(isRoom, target!, clientId)
        return
      }
      if (clientId) {
        socketStore.replaceUploadWithSend(isRoom, target!, clientId, result.content, result.meta)
      } else {
        options.send(result.content, result.meta)
      }
      succeeded = true
    } catch {
      // 错误提示由 axios 拦截器统一弹出
      if (clientId) socketStore.failUploadingMessage(isRoom, target!, clientId)
    } finally {
      uploadingCount.value = Math.max(0, uploadingCount.value - 1)
      if (clientId) {
        if (succeeded) uploadTasks.delete(clientId)
        else uploadTasks.set(clientId, () => runUpload(blob, buildForm, placeholderMeta, onSuccess))
      }
    }
  }

  /** 重新上传失败的文件；刷新后内存任务已丢失，提示用户重新选择 */
  const retryUpload = (message: ChatMessage) => {
    const clientId = message.clientId
    const task = clientId ? uploadTasks.get(clientId) : undefined
    if (!clientId || !task) {
      toast.warning(i18n.global.t('chat.uploadRetryExpired'))
      return
    }
    useSocketStore().removeMessageByClientId(!!options.isRoom, options.target?.() || '', clientId)
    uploadTasks.delete(clientId)
    void task()
  }

  const uploadImage = (file: Blob) => runUpload(
    file,
    async () => {
      const blob = await compressImage(file)
      const formData = new FormData()
      formData.append('file', blob, imageFilename(blob))
      return formData
    },
    { type: 'image', originalname: (file as File).name || i18n.global.t('chat.imgBroken') },
    (path, data, markdownMode) => {
      if (markdownMode) {
        insertIntoStory(`![](${path})`)
        return
      }
      return { content: path, meta: { type: 'image', size: data.size } }
    }
  )

  const uploadFile = (file: Blob) => runUpload(
    file,
    () => {
      const formData = new FormData()
      formData.append('file', file)
      return formData
    },
    { type: 'file', originalname: (file as File).name || i18n.global.t('chat.file') },
    (path, data, markdownMode) => {
      const originalname = data.originalname || (file as File).name || ''
      if (markdownMode) {
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
