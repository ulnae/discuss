import { computed, ref, type Ref } from 'vue'
import type { MentionRef } from '@/constants/events'

/** 群成员（只取候选列表需要的字段，房间页 sortedMember 结构天然兼容） */
export interface MentionMember {
  user_id: string
  user_info?: { username?: string }
  online?: boolean
}

interface UseMentionOptions {
  /** 候选成员（房间页已按群主/在线排序） */
  members: Ref<MentionMember[]>
  /** 当前输入框文本（props.modelValue） */
  text: Ref<string>
  /** 当前登录用户 id，候选里排除自己 */
  currentUserId: Ref<string | undefined>
  /** 成员列表是否仍在加载（浮层空态时显示加载提示） */
  membersLoading?: Ref<boolean>
  textareaRef: Ref<HTMLTextAreaElement | null>
  /** 选中成员后替换文本并定位光标（由组件 emit update:modelValue + nextTick 完成） */
  onReplace: (next: string, caret: number) => void
}

/** 光标前形如「@查询串」时触发（允许紧接前一条 @ 提及，便于连续 @ 多人） */
const TRIGGER = /@([^\s@]*)$/
const MAX_CANDIDATES = 10

/**
 * 输入框 @ 群成员：触发检测、候选过滤、键盘导航、选中插入、草稿与文本同步。
 * 不对文本做自定义语法：插入的仍是普通 `@用户名 `，
 * userId/用户名作为结构化元数据（MentionRef）随消息 meta 发送。
 */
export function useMention(options: UseMentionOptions) {
  const { members, text, currentUserId, membersLoading, textareaRef, onReplace } = options

  const active = ref(false)
  const query = ref('')
  const activeIndex = ref(0)
  /** 输入法组合期挂起检测，避免拼音未上屏就弹候选 */
  const composing = ref(false)

  /** 草稿：userId → username，发送前与最终文本对账 */
  const drafts = ref<Map<string, string>>(new Map())
  /** 刚选中的用户名：避免尾随空格被 v-model.trim 吃掉后候选再次弹出 */
  let suppressName: string | null = null

  const candidates = computed(() => {
    if (!active.value) return []
    const q = query.value.trim().toLowerCase()
    return members.value
      .filter((m) => !!m.user_id && m.user_id !== currentUserId.value)
      .filter((m) => {
        const name = m.user_info?.username || ''
        return !q || name.toLowerCase().includes(q)
      })
      .slice(0, MAX_CANDIDATES)
  })

  const close = () => {
    active.value = false
    query.value = ''
    activeIndex.value = 0
  }

  /** input / click / keyup 后按光标位置检测触发词 */
  const detect = () => {
    if (composing.value) return
    const el = textareaRef.value
    if (!el) return
    // 以 DOM 实时值为准：input 事件里 props.modelValue 可能还没同步回来
    const value = el.value ?? text.value
    const caret = el.selectionStart ?? value.length
    const hit = value.slice(0, caret).match(TRIGGER)
    if (!hit) {
      if (active.value) close()
      return
    }
    if (suppressName !== null) {
      // 尾随空格被 v-model.trim 吃掉后，keyup 会再次命中同一个 @用户名：
      // 只要查询串还是刚选中的名字就持续抑制，直到用户改写内容
      if (hit[1] === suppressName) {
        close()
        return
      }
      suppressName = null
    }
    const nextQuery = hit[1] ?? ''
    // 仅查询串变化时才重置高亮项：方向键后的 keyup 检测不能把用户的选择冲掉
    if (nextQuery !== query.value || !active.value) {
      query.value = nextQuery
      activeIndex.value = 0
    }
    active.value = true
  }

  /** 选中候选：替换 @查询串 为 @用户名 + 空格，并记录结构化元数据 */
  const select = (index: number) => {
    const member = candidates.value[index]
    if (!member) return
    const name = member.user_info?.username || ''
    if (!name) return
    const el = textareaRef.value
    const value = el?.value ?? text.value
    const caret = el?.selectionStart ?? value.length
    const at = caret - query.value.length - 1
    if (at < 0 || value.charAt(at) !== '@') {
      close()
      return
    }
    const next = `${value.slice(0, at)}@${name} ${value.slice(caret)}`
    const nextCaret = at + name.length + 2
    drafts.value = new Map(drafts.value).set(member.user_id, name)
    suppressName = name
    close()
    onReplace(next, nextCaret)
  }

  /**
   * 键盘拦截：返回 true 表示事件已被候选层消费（组件不再执行发送等默认逻辑）。
   * 候选未弹出时只有 Escape 会被吞掉（关掉可能残留的浮层）。
   */
  const handleKeydown = (e: KeyboardEvent): boolean => {
    if (!active.value) return false
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return true
    }
    if (!candidates.value.length) return false

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      activeIndex.value = (activeIndex.value + delta + candidates.value.length) % candidates.value.length
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Shift+Enter 保持换行语义
      if (e.key === 'Enter' && e.shiftKey) return false
      e.preventDefault()
      select(activeIndex.value)
      return true
    }
    return false
  }

  /** 发送前对账：只保留文本里仍出现的 @用户名，避免删掉的文本还带着 mention */
  const currentMentions = (): MentionRef[] => {
    const result: MentionRef[] = []
    drafts.value.forEach((name, id) => {
      if (text.value.includes(`@${name}`)) result.push({ id, name })
    })
    return result
  }

  const clear = () => {
    drafts.value = new Map()
    close()
  }

  return {
    active,
    query,
    activeIndex,
    candidates,
    composing,
    /** 浮层空态且成员仍在加载：显示"正在加载群成员…" */
    loading: computed(() => !!membersLoading?.value),
    detect,
    handleKeydown,
    /** 组件事件：input/click/keyup 后调用 */
    onCursorChange: detect,
    currentMentions,
    clear,
    select,
    close,
  }
}
