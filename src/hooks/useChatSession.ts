import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { ChatMessage } from '@/constants/events'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { usePaste } from '@/hooks/paste'
import { useFilePicker } from '@/hooks/useFilePicker'
import serverApi from '@/api'
import { compressImage, imageFilename } from '@/utils/image'
import { useMdPreference } from '@/hooks/mdPreference'

export interface ChatMessageMeta {
  type?: string
  size?: number
  originalname?: string
}

interface UseChatSessionOptions {
  history: ComputedRef<ChatMessage[]>
  send: (content: string, meta?: ChatMessageMeta) => void
  resend: (message: ChatMessage) => void
}

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

  const handleSend = () => {
    if (!story.value) return
    options.send(story.value)
    story.value = ''
  }

  const handleResend = (message: ChatMessage) => options.resend(message)

  /** Windows 下 multer 返回的 path 含反斜杠（public\1001\x.png），统一归一为正斜杠 */
  const normalizePath = (raw: unknown) => String(raw ?? '').replace(/\\/g, '/')

  /** Markdown 编辑模式：把上传结果以 Markdown 片段插入输入框正文，可与文字混排 */
  const insertIntoStory = (snippet: string) => {
    story.value = story.value ? `${story.value}\n${snippet}` : snippet
  }

  const uploadImage = async (file: Blob) => {
    const blob = await compressImage(file)
    const formData = new FormData()
    formData.append('file', blob, imageFilename(blob))
    serverApi.UploadUser(formData).then((res: any) => {
      if (res.code === 200) {
        const path = `/${normalizePath(res.data.path)}`
        // Markdown 编辑模式开启：插入输入框待混排发送；关闭：上传成功即直接发送
        if (mdInputEnabled.value) {
          insertIntoStory(`![](${path})`)
        } else {
          options.send(path, { type: 'image', size: res.data.size })
        }
      }
    }).catch(() => { /* 失败提示由 axios 拦截器统一弹出 */ })
  }

  const uploadFile = (file: Blob) => {
    const formData = new FormData()
    formData.append('file', file)
    serverApi.UploadUser(formData).then((res: any) => {
      if (res.code === 200) {
        const path = `/${normalizePath(res.data.path)}`
        if (mdInputEnabled.value) {
          insertIntoStory(`[${res.data.originalname || '文件'}](${path})`)
        } else {
          options.send(path, {
            type: 'file',
            size: res.data.size,
            originalname: res.data.originalname
          })
        }
      }
    }).catch(() => { /* 失败提示由 axios 拦截器统一弹出 */ })
  }

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
    pinToBottom
  }
}
