import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * 聊天区自动滚动（好友 / 群聊共用）。
 *
 * 设计要点：
 * 1. 用 ResizeObserver 观察「消息内容层」而非滚动容器 —— 图片/视频加载完成、字体渲染、
 *    新消息插入等一切高度变化都会被统一感知，无需在 Comment 里逐个 emit 'loaded'。
 * 2. 用 requestAnimationFrame 把同一帧内的多次高度变化合并成一次滚动，
 *    避免 N 张图片连续加载时反复读 scrollHeight / 写 scrollTop 造成强制同步布局。
 * 3. 贴底标志用普通变量（模板不消费，不需要响应式开销）；由容器 scroll 事件维护，
 *    因为内容撑高不会触发 scroll，所以能可靠区分「该补滚」与「用户主动上翻看历史」。
 *
 * @param containerRef 滚动容器（#messageContainer）的模板引用，
 *                     其第一个子元素应为消息内容层（.msg-list）。
 */
export function useAutoScroll(containerRef: Ref<HTMLElement | null>) {
    let pinned = true
    let raf = 0
    let ro: ResizeObserver | null = null

    const scrollToBottom = () => {
        const el = containerRef.value
        if (!el) return
        // 直接定位到最大滚动距离，浏览器会 clamp 到 scrollHeight - clientHeight。
        // 瞬时到位，不用 smooth —— 动画未完成会停在半路，表现为最新消息只露时间行。
        el.scrollTop = el.scrollHeight
    }

    /** rAF 合并：同帧 N 次尺寸变化只滚一次 */
    const scheduleScroll = () => {
        if (raf) return
        raf = requestAnimationFrame(() => {
            raf = 0
            if (pinned) scrollToBottom()
        })
    }

    const onScroll = () => {
        const el = containerRef.value
        if (!el) return
        pinned = el.scrollHeight - el.scrollTop - el.clientHeight <= 40
    }

    /** 切换会话时调用：强制回到贴底状态并滚到底（DOM 更新后由 rAF 执行） */
    const pinToBottom = () => {
        pinned = true
        scheduleScroll()
    }

    onMounted(() => {
        const el = containerRef.value
        if (!el) return
        // 观察内容层（高度随消息变化），不是滚动容器本身（flex:1 固定高度，观察不到内容变化）
        const list = el.firstElementChild ?? el
        ro = new ResizeObserver(scheduleScroll)
        ro.observe(list)
        el.addEventListener('scroll', onScroll, { passive: true })
        // 首次进入：消息多为异步 hydrate，先置贴底再瞬时滚，后续由 RO + rAF 补滚兜底
        pinned = true
        scrollToBottom()
    })

    onUnmounted(() => {
        ro?.disconnect()
        const el = containerRef.value
        if (el) el.removeEventListener('scroll', onScroll)
        if (raf) cancelAnimationFrame(raf)
    })

    return { scrollToBottom, pinToBottom }
}
