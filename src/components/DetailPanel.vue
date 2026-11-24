<template>
  <!-- 遮罩与面板保持平级，直接作为 .chat-shell 的子节点，移动端绝对定位才能贴住聊天区 -->
  <div class="detail-mask" v-show="open" @click="emit('close')"></div>

  <aside class="detail-panel" v-show="open" :style="{ '--detail-width': width + 'px' }">
    <header class="detail-head">
      <span><slot name="title">{{ title }}</slot></span>
      <button type="button" class="icon-btn detail-close" title="关闭" @click="emit('close')">
        <AppIcon name="close" :size="14" :stroke-width="1.8" />
      </button>
    </header>

    <LoadingBlock v-if="loading" class="detail-loading" :text="loadingText" />

    <template v-else>
      <div class="detail-body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="detail-footer">
        <slot name="footer" />
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'
import LoadingBlock from '@/components/ui/LoadingBlock.vue'

withDefaults(defineProps<{
  open: boolean
  title: string
  /** 桌面端面板宽度（px）；窄屏抽屉另有上限 */
  width?: number
  loading?: boolean
  loadingText?: string
}>(), {
  width: 224,
  loading: false,
  loadingText: '正在加载…'
})

const emit = defineEmits<{ close: [] }>()
</script>

<style lang="scss" scoped>
/* 桌面端：右侧常驻信息面板 */
.detail-panel {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 0.85rem;
    width: var(--detail-width);
    padding: 0.9rem;
    border-left: 1px solid var(--border);
    overflow-y: auto;
}

.detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-2);
}

/* 抽屉关闭按钮：窄屏抽屉形态下必须可见，否则关不掉 */
.detail-close {
    width: 26px;
    height: 26px;
    border-radius: 8px;

    svg {
        width: 14px;
        height: 14px;
    }
}

/* 面板内的 loading 占位：比通用列表更紧凑 */
.detail-loading {
    padding: 2rem 0.5rem;
}

.detail-body {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-height: 0;
}

/* 删除好友 / 退出房间按钮贴在面板底部 */
.detail-footer {
    margin-top: auto;
}

.detail-mask {
    display: none;
}

/* 移动端：面板改成右侧抽屉，遮罩点击可关闭 */
@media (max-width: 900px) {
    .detail-panel {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 30;
        width: min(86%, 320px);
        border-left: 1px solid var(--border);
        background: var(--surface-solid);
        box-shadow: var(--drawer-shadow);
    }

    .detail-mask {
        /* 基础样式是 display:none，这里必须恢复显示，否则遮罩永远不出现、抽屉关不掉 */
        display: block;
        position: absolute;
        inset: 0;
        z-index: 25;
        background: var(--mask-bg);
        backdrop-filter: blur(1px);
    }
}
</style>
