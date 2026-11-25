import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { MentionRef } from '@/constants/events'

/**
 * 聊天消息 Markdown 渲染（唯一入口，供消息气泡 MessageBubble.vue 与输入区预览共用）：
 * - 输入区无任何 Markdown UI（隐藏彩蛋）：用户手写 Markdown 语法发送，气泡渲染成富文本。
 * - 消息来自他人，绝不允许裸 v-html：输出必须经 DOMPurify 消毒。
 * - LRU 缓存按原文缓存 HTML，50 条可见窗口滚动/重渲染时不重复解析。
 * - renderChatContent 在消毒后把 @ 的 token 替换为高亮 span，回显与预览共用，
 *   缓存 key 带上 mention 维度，避免相同正文不同 @ 对象串味。
 */

const API_BASE = import.meta.env.VITE_APP_API_BASE_URL || ''

marked.setOptions({
    gfm: true,
    // 聊天场景：单个换行即换行，不必要求行尾两个空格
    breaks: true,
})

/* 消毒后统一修整属性：
   - img/a 的站内相对路径（上传文件返回 /upload/...）补全 API 前缀
   - 链接一律新窗口打开 + noopener
   - 图片懒加载，避免历史消息一次性拉取全部图片 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG' || node.tagName === 'A') {
        const attr = node.tagName === 'IMG' ? 'src' : 'href'
        const value = node.getAttribute(attr) || ''
        if (value.startsWith('/') && !value.startsWith('//')) {
            node.setAttribute(attr, API_BASE + value)
        }
    }
    if (node.tagName === 'IMG') {
        node.setAttribute('loading', 'lazy')
    } else if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
    }
})

const CACHE_MAX = 300
const cache = new Map<string, string>()

/** LRU 缓存包装（普通正文 key 为原文，@ 正文 key 追加 mention 维度） */
function withCache(key: string, build: () => string): string {
    const hit = cache.get(key)
    if (hit !== undefined) {
        cache.delete(key)
        cache.set(key, hit)
        return hit
    }
    const html = build()
    cache.set(key, html)
    if (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
    }
    return html
}

/** Markdown → 消毒后的 HTML；解析失败降级为转义后的纯文本 */
function sanitizeMarkdown(source: string): string {
    try {
        const dirty = marked.parse(source, { async: false })
        return DOMPurify.sanitize(dirty, { ADD_ATTR: ['target'] })
    } catch {
        return DOMPurify.sanitize(
            source
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>'),
        )
    }
}

/** Markdown → 消毒后的 HTML。空串原样返回。 */
export function renderMarkdown(source: string): string {
    if (!source) return ''
    return withCache(source, () => sanitizeMarkdown(source))
}

const escapeHtml = (s: string) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * 带 @ 高亮的正文渲染（消息回显 / 输入区预览共用）。
 * 流程：@用户名 → 唯一 token → marked + DOMPurify → token 替换为高亮 span。
 * span 在消毒之后生成（内容已转义），既不会被 Markdown 干扰也不会引入 XSS。
 * @param mentions 结构化 @ 元数据（发送时随消息 meta 持久化，历史消息也能高亮）
 * @param currentUserId 当前登录用户 id，命中时给自己加 is-me 强调样式
 */
export function renderChatContent(
    source: string,
    mentions: MentionRef[] = [],
    currentUserId?: string,
): string {
    if (!source) return ''
    if (!mentions.length) return renderMarkdown(source)

    const key = `${source}\u0000${mentions.map((m) => `${m.id}:${m.name}`).join(',')}\u0000${currentUserId || ''}`
    return withCache(key, () => {
        // token 前缀避开正文里可能出现的相同字符串
        let prefix = 'MDATMB'
        while (source.includes(prefix)) prefix += 'X'
        const tokens = mentions.map((_, i) => `${prefix}${i}END${prefix}`)

        // 按 mention 名称精确替换（不依赖尾随空格：v-model.trim 会吃掉空格，
        // 输入后常变成「@张三你好」这种粘连文本）；长名字优先，避免短名前缀误替换
        let prepared = source
        mentions
            .map((m, i) => ({ m, i }))
            .sort((a, b) => b.m.name.length - a.m.name.length)
            .forEach(({ m, i }) => {
                prepared = prepared.split(`@${m.name}`).join(tokens[i])
            })

        let html = sanitizeMarkdown(prepared)
        mentions.forEach((m, i) => {
            const cls = m.id === currentUserId ? 'mention is-me' : 'mention'
            const span = `<span class="${cls}" data-user-id="${escapeHtml(m.id)}">@${escapeHtml(m.name)}</span>`
            html = html.split(tokens[i]).join(span)
        })
        return html
    })
}
