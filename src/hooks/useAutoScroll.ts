import { onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'

export interface AutoScrollOptions {
    /** 当前会话最后一条消息标识：变化时自动滚到底（新消息到达） */
    lastMessageKey?: () => string | undefined
    /** 是否还有更早的消息可加载 */
    hasEarlier?: () => boolean
    /** 加载更早的消息：只需修改可见条数，DOM 更新与滚动锚定由本 hook 统一处理 */
    loadEarlier?: () => void
}

const BOTTOM_TOLERANCE = 40   // 距底多少像素算“贴底”
const REACH_TOP = 24          // 距顶多少像素算“到顶”，触发加载更早消息
const SUPPRESS_MS = 200       // 程序化滚动后屏蔽 scroll 事件的窗口
const ANCHOR_MS = 300         // 加载更多锚定后，屏蔽 RO 跟随滚动的窗口

/**
 * 聊天区自动滚动（好友 / 群聊共用）。
 *
 * 关键设计：pinned（是否跟随底部）只能由「用户真实交互」翻转，绝不由 scroll 事件反推。
 * 因为新消息插入、图片撑高、程序化滚动都会派发 scroll 事件，若用它反推，会出现
 * 「新消息插入 → scrollHeight 变大但 scrollTop 还是旧值 → 误判离底 → pinned=false
 * → 后续所有消息都不滚」的竞态。
 *
 * 三类信号：
 * 1. 新消息到达（watch lastMessageKey）—— 贴底时显式滚到底；
 * 2. 内容尺寸变化（ResizeObserver）—— 图片/视频撑高补滚，rAF 合并同帧多次变化；
 * 3. 用户交互（wheel / touchmove / keydown）—— 唯一能把 pinned 翻成 false 的来源。
 *
 * 另外统一处理「上滑到顶加载更早消息」：顶部插入内容后，把 scrollTop 增加相同的
 * 高度差做视觉锚定，保证当前屏幕上的消息停在原位，不跳到最早记录。
 */
export function useAutoScroll(
    containerRef: Ref<HTMLElement | null>,
    options: AutoScrollOptions
) {
    const { lastMessageKey, hasEarlier, loadEarlier } = options
    let pinned = true
    let raf = 0
    let ro: ResizeObserver | null = null
    let suppressUntil = 0
    let anchorUntil = 0
    let lastContentHeight = 0
    let loadingEarlier = false

    const isNearBottom = (el: HTMLElement) =>
        el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_TOLERANCE

    const scrollToBottom = () => {
        const el = containerRef.value
        if (!el) return
        // 先屏蔽，再滚动：scroll 事件异步派发，若不屏蔽会被 onScroll 当成用户上翻
        suppressUntil = performance.now() + SUPPRESS_MS
        el.scrollTop = el.scrollHeight
    }

    /** rAF 合并：同帧 N 次尺寸变化只滚一次 */
    const scheduleScroll = () => {
        if (raf) return
        raf = requestAnimationFrame(() => {
            raf = 0
            // 加载更多的锚定期间不要跟随滚动，否则会把视图拽到底部
            if (loadingEarlier || performance.now() < anchorUntil) return
            suppressUntil = performance.now() + SUPPRESS_MS
            if (pinned) {
                const el = containerRef.value
                if (el) el.scrollTop = el.scrollHeight
            }
        })
    }

    /**
     * 上滑到顶（或点击“查看更早”）时加载更早的消息。
     * 记录加载前的 scrollHeight / scrollTop，待新消息插入 DOM 后把 scrollTop
     * 增加相同的高度差 —— 视觉上当前消息保持原位，不会跳到最早的记录。
     */
    const loadMore = async () => {
        const el = containerRef.value
        if (!el || !loadEarlier || !hasEarlier?.() || loadingEarlier) return
        if (el.scrollTop > REACH_TOP) return

        loadingEarlier = true
        const prevHeight = el.scrollHeight
        const prevTop = el.scrollTop
        try {
            loadEarlier()                 // 同步修改 visibleCount
            await nextTick()              // 等待顶部新消息插入 DOM
            const delta = el.scrollHeight - prevHeight
            el.scrollTop = prevTop + delta
            anchorUntil = performance.now() + ANCHOR_MS
            suppressUntil = performance.now() + SUPPRESS_MS
        } finally {
            loadingEarlier = false
        }
    }

    const onScroll = () => {
        if (performance.now() < suppressUntil) return
        const el = containerRef.value
        if (!el) return
        // 只在用户明确滚回底部时恢复跟随；「离开底部」只由 onUserIntent 判定
        if (isNearBottom(el)) pinned = true
        // 上滑到顶：加载更早消息（loadMore 内部有防重入与锚定）
        if (el.scrollTop <= REACH_TOP) loadMore()
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
        // 加载更多的高度变化由锚定逻辑负责，不当作“内容撑高”去跟随
        if (loadingEarlier) return
        suppressUntil = performance.now() + SUPPRESS_MS
        scheduleScroll()
    }

    /** 切换会话 / 强制回到底部 */
    const pinToBottom = () => {
        pinned = true
        anchorUntil = 0
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

    // 新消息到达：显式触发（flush:'post' 保证 DOM 已更新）
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

    return { scrollToBottom, pinToBottom, loadMore }
}
