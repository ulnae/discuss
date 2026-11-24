import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * 聊天消息 Markdown 渲染（唯一入口）：
 * - 气泡正文（Comment.vue）与输入框预览（MessageComposer.vue）共用同一函数，
 *   保证「所见即所发」。
 * - 消息来自他人，绝不允许裸 v-html：输出必须经 DOMPurify 消毒。
 * - LRU 缓存按原文缓存 HTML，50 条可见窗口滚动/重渲染时不重复解析。
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

/** Markdown → 消毒后的 HTML。空串原样返回；解析失败降级为转义后的纯文本。 */
export function renderMarkdown(source: string): string {
    if (!source) return ''

    const hit = cache.get(source)
    if (hit !== undefined) {
        // LRU 命中：移到尾部保持新鲜度
        cache.delete(source)
        cache.set(source, hit)
        return hit
    }

    let html: string
    try {
        const dirty = marked.parse(source, { async: false })
        html = DOMPurify.sanitize(dirty, { ADD_ATTR: ['target'] })
    } catch {
        html = DOMPurify.sanitize(
            source
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>'),
        )
    }

    cache.set(source, html)
    if (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
    }
    return html
}
