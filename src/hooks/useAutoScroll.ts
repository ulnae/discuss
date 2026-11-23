import { onMounted, onUnmounted, watch, type Ref } from 'vue'

/**
 * 聊天区自动滚动（好友 / 群聊共用）。
 *
 * 关键设计：pinned（是否跟随底部）只能由「用户真实交互」翻转，绝不由 scroll 事件反推。
 * 因为新消息插入、图片撑高、程序化滚动都会派发 scroll 事件，若用它反推，会出现
 * 「新消息插入 → scrollHeight 变大但 scrollTop 还是旧值 → 误判离底 → pinned=false
 * → 后续所有消息都不滚」的竞态（旧实现正是踩了这个坑）。
 *
 * 信号来源收敛为三类：
 * 1. 新消息到达（watch lastMessageKey）—— 显式触发，flush:'post' 保证 DOM 已更新；
 * 2. 内容尺寸变化（ResizeObserver）—— 图片/视频撑高补滚，rAF 合并同帧多次变化；
 * 3. 用户交互（wheel / touchmove / keydown）—— 唯一能把 pinned 翻成 false 的来源。
 *
 * @param containerRef 滚动容器（#messageContainer）的模板引用，
 *                     其第一个子元素应为消息内容层（.msg-list）。
 * @param lastMessageKey 取当前会话最后一条消息标识的 getter；变化时显式触发跟随滚动。
 */
export function useAutoScroll(
    containerRef: Ref<HTMLElement | null>,
    lastMessageKey?: () => string | undefined
) {
    let pinned = true
    let raf = 0
    let ro: ResizeObserver | null = null
    /** 这段时间内忽略 scroll 事件：程序化滚动 / 内容变化引起的滚动不是用户意图 */
    let suppressUntil = 0
    let lastContentHeight = 0

    const isNearBottom = (el: HTMLElement) =>
        el.scrollHeight - el.scrollTop - el.clientHeight <= 40

    const scrollToBottom = () => {
        const el = containerRef.value
        if (!el) return
        // 先屏蔽，再滚动：scroll 事件异步派发，若不屏蔽会被 onScroll 当成用户上翻
        suppressUntil = performance.now() + 200
        el.scrollTop = el.scrollHeight
    }

    /** rAF 合并：同帧 N 次尺寸变化只滚一次 */
    const scheduleScroll = () => {
        if (raf) return
        raf = requestAnimationFrame(() => {
            raf = 0
            // 滚到底也算程序化滚动，同样屏蔽其 scroll 事件
            suppressUntil = performance.now() + 200
            if (pinned) {
                const el = containerRef.value
                if (el) el.scrollTop = el.scrollHeight
            }
        })
    }

    const onScroll = () => {
        if (performance.now() < suppressUntil) return
        const el = containerRef.value
        if (!el) return
        // 只在用户明确滚回底部时恢复跟随；「离开底部」只由 onUserIntent 判定
        if (isNearBottom(el)) pinned = true
    }

    /** 用户真实交互：这是唯一能把 pinned 翻成 false 的路径 */
    const onUserIntent = () => {
        const el = containerRef.value
        if (!el) return
        pinned = isNearBottom(el)
    }

    const onResize: ResizeObserverCallback = (entries) => {
        const height = entries[0]?.contentRect.height ?? 0
        if (height === lastContentHeight) return
        lastContentHeight = height
        // 内容变高期间的 scroll 事件来自布局/滚动锚定，不是用户意图
        suppressUntil = performance.now() + 200
        scheduleScroll()
    }

    /** 切换会话 / 强制回到底部 */
    const pinToBottom = () => {
        pinned = true
        scrollToBottom()
    }

    onMounted(() => {
        const el = containerRef.value
        if (!el) return
        const list = (el.firstElementChild ?? el) as HTMLElement
        lastContentHeight = list.getBoundingClientRect().height
        ro = new ResizeObserver(onResize)
        ro.observe(list)
        el.addEventListener('scroll', onScroll, { passive: true })
        el.addEventListener('wheel', onUserIntent, { passive: true })
        el.addEventListener('touchmove', onUserIntent, { passive: true })
        el.addEventListener('keydown', onUserIntent)
        // 首屏：消息多为异步 hydrate，先置贴底再瞬时滚，后续由 watch / RO 兜底
        pinned = true
        scrollToBottom()
    })

    // 新消息到达：显式触发（旧实现删掉了这个 watch，导致只靠 RO，丢失信号）
    if (lastMessageKey) {
        watch(lastMessageKey, () => {
            if (pinned) scrollToBottom()
        }, { flush: 'post' })
    }

    onUnmounted(() => {
        ro?.disconnect()
        const el = containerRef.value
        if (el) {
            el.removeEventListener('scroll', onScroll)
            el.removeEventListener('wheel', onUserIntent)
            el.removeEventListener('touchmove', onUserIntent)
            el.removeEventListener('keydown', onUserIntent)
        }
        if (raf) cancelAnimationFrame(raf)
    })

    return { scrollToBottom, pinToBottom }
}
