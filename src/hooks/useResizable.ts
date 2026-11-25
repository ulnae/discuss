import { onMounted, onUnmounted, type Ref } from 'vue'

type ResizeDirection = 'vertical' | 'horizontal'

interface UseResizableOptions {
  /**
   * 拖拽方向：
   * - vertical：手柄在顶部，向上拖增大、向下拖减小（调节 height）
   * - horizontal：手柄在右侧，向右拖增大、向左拖减小（调节 width）
   */
  direction?: ResizeDirection
  /** 最小尺寸 px */
  minSize?: number
  /** 最大尺寸 px */
  maxSize?: number
  /** 初始尺寸 px */
  initialSize?: number
}

/** 与 design.scss 移动端断点保持一致 */
const MOBILE_QUERY = '(max-width: 768px)'

/**
 * 为目标容器自动插入拖拽手柄，支持上下/左右拖拽调节尺寸
 * @param targetRef 目标容器的 ref
 */
export const useResizable = (
  targetRef: Ref<HTMLElement | null>,
  options: UseResizableOptions = {}
) => {
  const {
    direction = 'vertical',
    minSize = 80,
    maxSize = 800,
    initialSize = 240
  } = options

  const isVertical = direction === 'vertical'
  const sizeProp: 'height' | 'width' = isVertical ? 'height' : 'width'
  const cursor = isVertical ? 'ns-resize' : 'ew-resize'

  let dragging = false
  let startPos = 0
  let startSize = 0
  let handleEl: HTMLDivElement | null = null
  let installed = false

  const onMove = (e: MouseEvent) => {
    if (!dragging || !targetRef.value) return
    const current = isVertical ? e.clientY : e.clientX
    const delta = current - startPos
    // vertical: 手柄在顶部 => 向上拖 delta 为负 => 尺寸增大 => startSize - delta
    // horizontal: 手柄在右侧 => 向右拖 delta 为正 => 尺寸增大 => startSize + delta
    const next = Math.max(
      minSize,
      Math.min(maxSize, startSize + (isVertical ? -delta : delta))
    )
    targetRef.value.style[sizeProp] = next + 'px'
  }

  const onUp = () => {
    if (!dragging) return
    dragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const onDown = (e: MouseEvent) => {
    if (!targetRef.value) return
    dragging = true
    startPos = isVertical ? e.clientY : e.clientX
    startSize = isVertical ? targetRef.value.offsetHeight : targetRef.value.offsetWidth
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  /**
   * PC 端安装：写初始尺寸、注入手柄、绑定鼠标监听。
   * 移动端没有鼠标拖拽这回事：不注入手柄，也不写死固定尺寸，
   * 交给 CSS 按屏幕自适应（否则窄屏上 inline px 尺寸会把布局撑坏）。
   */
  const install = () => {
    const el = targetRef.value
    if (!el || installed) return
    installed = true

    el.style[sizeProp] = initialSize + 'px'
    el.style.position = 'relative'

    handleEl = document.createElement('div')
    // 类名用于统一视觉（见 assets/style/design.scss 的 .resize-handle）
    handleEl.className = `resize-handle ${isVertical ? 'is-v' : 'is-h'}`
    const styleParts = ['position:absolute', 'z-index:10', 'user-select:none']
    if (isVertical) {
      styleParts.push('top:-4px', 'left:0', 'right:0', 'height:8px')
    } else {
      styleParts.push('right:-4px', 'top:0', 'bottom:0', 'width:8px')
    }
    styleParts.push(`cursor:${cursor}`)
    handleEl.style.cssText = styleParts.join(';')
    handleEl.addEventListener('mousedown', onDown)
    el.appendChild(handleEl)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  /** 卸载：清掉内联尺寸与手柄，交还 CSS 自适应（移动端模式） */
  const uninstall = () => {
    if (!installed) return
    installed = false

    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    handleEl?.removeEventListener('mousedown', onDown)
    handleEl?.remove()
    handleEl = null

    const el = targetRef.value
    if (!el) return
    el.style.removeProperty(sizeProp)
    el.style.removeProperty('position')
  }

  /**
   * 断点切换（含 DevTools 设备模拟）：跨过 768px 时拆装一次，
   * 让内联拖拽尺寸只在 PC 生效、移动端始终交给 CSS。
   */
  const mql = window.matchMedia(MOBILE_QUERY)
  const onBreakpointChange = (e: MediaQueryListEvent) => {
    if (e.matches) uninstall()
    else install()
  }

  onMounted(() => {
    if (!mql.matches) install()
    mql.addEventListener('change', onBreakpointChange)
  })

  onUnmounted(() => {
    mql.removeEventListener('change', onBreakpointChange)
    uninstall()
  })
}
