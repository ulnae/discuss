<template>
  <div ref="inputAreaRef" class="composer">
    <div class="composer-box">
      <!-- @ 群成员候选浮层：仅在群聊传入成员列表时出现，overlay 不占输入区高度 -->
      <div v-if="mentionActive && mentionCandidates.length" class="mention-popup">
        <div v-for="(m, i) in mentionCandidates" :key="m.user_id" class="mention-option"
          :class="{ 'is-active': i === mentionIndex }" @mousedown.prevent @click="selectMention(i)">
          <UserAvatar :name="m.user_info?.username || '?'" class="mention-avatar" />
          <span class="mention-name">{{ m.user_info?.username }}</span>
          <span class="mention-online" :class="{ 'is-online': m.online }"></span>
        </div>
      </div>

      <!-- Markdown 编辑模式（设置里开启后显示）：左侧格式按钮，右侧预览开关 -->
      <div v-if="mdInputEnabled" class="composer-toolbar">
        <div class="composer-format">
          <button type="button" class="icon-btn" title="粗体 **" @mousedown.prevent @click="applyFormat('bold')">
            <AppIcon name="bold" :size="16" :stroke-width="1.7" />
          </button>
          <button type="button" class="icon-btn" title="斜体 *" @mousedown.prevent @click="applyFormat('italic')">
            <AppIcon name="italic" :size="16" :stroke-width="1.7" />
          </button>
          <button type="button" class="icon-btn" title="行内代码 `" @mousedown.prevent @click="applyFormat('code')">
            <AppIcon name="code" :size="16" :stroke-width="1.7" />
          </button>
          <button type="button" class="icon-btn" title="代码块 ```" @mousedown.prevent @click="applyFormat('codeblock')">
            <AppIcon name="codeblock" :size="16" :stroke-width="1.7" />
          </button>
          <button type="button" class="icon-btn" title="链接 [文本](地址)" @mousedown.prevent @click="applyFormat('link')">
            <AppIcon name="link" :size="16" :stroke-width="1.7" />
          </button>
          <button type="button" class="icon-btn" title="引用 >" @mousedown.prevent @click="applyFormat('quote')">
            <AppIcon name="quote" :size="16" :stroke-width="1.7" />
          </button>
        </div>
        <button type="button" class="icon-btn" :class="{ 'is-active': preview }"
          :title="preview ? '返回编辑' : '预览 Markdown'" @click="preview = !preview">
          <AppIcon name="eye" :size="17" :stroke-width="1.7" />
        </button>
      </div>

      <textarea v-if="!preview" ref="textareaRef" :value="modelValue"
        :placeholder="placeholder"
        @keydown="onKeydown" @input="onInput" @click="onMentionCursorChange" @keyup="onMentionCursorChange"
        @compositionstart="mentionComposing = true" @compositionend="onCompositionEnd" @blur="closeMentions"></textarea>
      <div v-else class="composer-preview cm-md markdown-body md-themed">
        <div v-if="previewHtml" v-html="previewHtml"></div>
        <span v-else class="composer-preview-empty">暂无内容可预览</span>
      </div>

      <div class="composer-actions">
        <slot name="actions" />
        <button type="button" class="icon-btn" title="发送图片" @click="emit('image')">
          <AppIcon name="image" :size="18" :stroke-width="1.6" />
        </button>
        <button type="button" class="icon-btn" title="发送文件" @click="emit('file')">
          <AppIcon name="file" :size="18" :stroke-width="1.6" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { AppIcon, UserAvatar } from '@/components/ui'

import { useResizable } from '@/hooks/useResizable'
import { useMdPreference } from '@/hooks/useMdPreference'
import { renderChatContent } from '@/utils/markdown'

import { useMention, type MentionMember } from '@/hooks/useMention'
import type { MentionRef } from '@/constants/events'
import { useUserStore } from '@/store/modules/user'

const props = defineProps<{
  modelValue: string
  /** 群聊成员列表；私聊不传 → @ 功能完全不激活 */
  mentionMembers?: MentionMember[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** 发送时带出 @ 的结构化元数据（私聊为空数组） */
  send: [mentions?: MentionRef[]]
  image: []
  file: []
}>()

const { mdInputEnabled } = useMdPreference()
const userStore = useUserStore()

const inputAreaRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
useResizable(inputAreaRef, { direction: 'vertical', minSize: 150, maxSize: 600, initialSize: 180 })

/* ---------- @ 群成员（仅群聊传入 mentionMembers 时启用） ---------- */

const {
  active: mentionActive,
  activeIndex: mentionIndex,
  candidates: mentionCandidates,
  composing: mentionComposing,
  onCursorChange: onMentionCursorChange,
  handleKeydown: handleMentionKeydown,
  currentMentions,
  clear: clearMentions,
  select: selectMention,
  close: closeMentions,
} = useMention({
  members: computed(() => props.mentionMembers || []),
  text: computed(() => props.modelValue),
  currentUserId: computed(() => userStore.userInfo.id),
  textareaRef,
  onReplace: (next, caret) => {
    emit('update:modelValue', next)
    nextTick(() => {
      const el = textareaRef.value
      el?.focus()
      el?.setSelectionRange(caret, caret)
      onMentionCursorChange()
    })
  },
})

const placeholder = '输入消息，回车发送'

/** 输入法组合结束后再检测 @，避免拼音未上屏就弹候选 */
const onCompositionEnd = () => {
  mentionComposing.value = false
  onMentionCursorChange()
}

/** 统一键盘入口：候选优先消费（↑↓/Enter/Tab/Esc），否则 Enter 发送 */
const onKeydown = (e: KeyboardEvent) => {
  if (e.isComposing || mentionComposing.value) return
  if (handleMentionKeydown(e)) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('send', currentMentions())
    clearMentions()
  }
}

/** 模板里不写 TS 断言（模板表达式按 JS 解析，as 会飘红），断言放到 script 内 */
const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  onMentionCursorChange()
}

/* ---------- 预览（仅 Markdown 编辑模式开启时可用） ---------- */

const preview = ref(false)
/** 与消息回显共用渲染函数，预览里 @ 也高亮，所见即所得 */
const previewHtml = computed(() => (
  preview.value
    ? renderChatContent(props.modelValue, currentMentions(), userStore.userInfo.id)
    : ''
))

/* ---------- Markdown 工具栏：按光标位置包裹/插入 ---------- */

type FormatKind = 'bold' | 'italic' | 'code' | 'codeblock' | 'link' | 'quote'

const applyFormat = (kind: FormatKind) => {
  const el = textareaRef.value
  if (!el) return
  const value = props.modelValue
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? start
  const selected = value.slice(start, end)
  let next = value
  let caret = start

  if (kind === 'bold' || kind === 'italic' || kind === 'code') {
    const mark = kind === 'bold' ? '**' : kind === 'italic' ? '*' : '`'
    const text = selected || (kind === 'bold' ? '粗体' : kind === 'italic' ? '斜体' : '代码')
    next = `${value.slice(0, start)}${mark}${text}${mark}${value.slice(end)}`
    caret = start + mark.length + text.length + mark.length
  } else if (kind === 'link') {
    const text = selected || '链接文本'
    const url = 'https://'
    next = `${value.slice(0, start)}[${text}](${url})${value.slice(end)}`
    // 光标定位到 url 占位并选中，方便直接输入地址
    const urlStart = start + text.length + 3
    nextTick(() => {
      el.focus()
      el.setSelectionRange(urlStart, urlStart + url.length)
    })
    emit('update:modelValue', next)
    return
  } else {
    // 块级语法：代码块 / 引用，前后补换行
    const padBefore = start > 0 && value.charAt(start - 1) !== '\n' ? '\n' : ''
    if (kind === 'codeblock') {
      const body = selected || '代码'
      const block = `${padBefore}\`\`\`\n${body}\n\`\`\`\n`
      next = `${value.slice(0, start)}${block}${value.slice(end)}`
      caret = start + block.length
    } else {
      const body = (selected || '引用内容').split('\n').map((line) => `> ${line}`).join('\n')
      const block = `${padBefore}${body}\n`
      next = `${value.slice(0, start)}${block}${value.slice(end)}`
      caret = start + block.length
    }
  }

  emit('update:modelValue', next)
  nextTick(() => {
    el.focus()
    el.setSelectionRange(caret, caret)
  })
}
</script>
