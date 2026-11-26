<template>
    <img v-if="message.type === 'image'" :src="`${VITE_APP_API_BASE_URL}${message.content}`" alt="图片已失效"
        class="cm-image" @click="handlePreviewImage(message.content)" />
    <template v-else-if="message.type === 'file'">
        <video class="cm-media" controls v-if="isUrlEndWith(`${VITE_APP_API_BASE_URL}${message.content}`, ['mp4', 'webm'])">
            <source :src="`${VITE_APP_API_BASE_URL}${message.content}`">
        </video>
        <audio class="cm-audio" controls v-else-if="isUrlEndWith(`${VITE_APP_API_BASE_URL}${message.content}`, ['mp3', 'wav'])">
            <source :src="`${VITE_APP_API_BASE_URL}${message.content}`">
        </audio>
        <img v-else-if="isUrlEndWith(`${VITE_APP_API_BASE_URL}${message.content}`, ['svg', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])"
            :src="`${VITE_APP_API_BASE_URL}${message.content}`" alt="图片已失效" class="cm-image"
            @click="handlePreviewImage(message.content)" />
        <a v-else class="cm-file" :href="`${VITE_APP_API_BASE_URL}${message.content}`" target="_blank">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
                stroke-linejoin="round" aria-hidden="true">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M5 3h9l5 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            </svg>
            <span>{{ fileDisplayName }}</span>
        </a>
    </template>
    <!-- 正文渲染：视觉由 mdPreference 注入的渲染主题接管（.md-themed 作用域），
         深色语境（夜间模式 / 自己的深色气泡）的反色适配见 design.scss -->
    <div v-else class="cm-md markdown-body md-themed" v-html="renderedHtml"></div>
    <!-- 发送状态：绝对定位成气泡角标，脱离文档流 —— 状态切换不再改变消息高度 -->
    <span v-if="message.status === 'sending'" class="cm-status cm-status-sending" title="发送中…">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"
            aria-hidden="true">
            <path d="M12 4a8 8 0 1 0 8 8" />
        </svg>
    </span>
    <button v-else-if="message.status === 'failed'" type="button" class="cm-status cm-status-failed"
        title="发送失败，点击重试" aria-label="发送失败，点击重试" @click="$emit('resend')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M12 7.5v5.5" />
            <circle cx="12" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
        </svg>
    </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { isUrlEndWith } from "@/utils/index";
import { renderChatContent } from "@/utils/markdown";
import { useUserStore } from "@/store/modules/user";

const props = defineProps({
    message: {
        type: Object,
        required: true
    }
});

const userStore = useUserStore();
/** 群聊 @ 高亮与输入区预览共用同一渲染函数；历史消息无 mentions 时走原 Markdown 渲染 */
const renderedHtml = computed(() => renderChatContent(
    String(props.message.content ?? ''),
    props.message.mentions || [],
    userStore.userInfo.id
));

/** 文件名兜底：优先后端回传的原始名，缺失时从 URL 末段解析（去 query/hash、解码） */
const fileDisplayName = computed(() => {
    const name = props.message.originalname;
    if (name) return name;
    const path = String(props.message.content ?? '').split(/[?#]/)[0];
    const last = path.split('/').pop();
    if (!last) return '下载文件';
    try {
        return decodeURIComponent(last) || '下载文件';
    } catch {
        return last;
    }
});

defineEmits(['resend']);

const VITE_APP_API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL
const handlePreviewImage = (url: string) => {
    window.open(`${VITE_APP_API_BASE_URL}${url}`);
}
// 媒体加载导致的高度变化统一由父级 ResizeObserver 感知，组件不再关心滚动
</script>

<style lang="scss" scoped>
.cm-image {
    display: block;
    max-width: min(320px, 100%);
    max-height: 260px;
    border-radius: 10px;
    object-fit: cover;
    cursor: zoom-in;
}

.cm-media {
    display: block;
    max-width: min(320px, 100%);
    max-height: 260px;
    border-radius: 10px;
}

.cm-audio {
    /* 不能用 width: min(280px, 100%)：.bubble 是 flex 列布局下 shrink-to-fit 的子项，
       宽度由内容决定，百分比宽度相对它解析会形成循环依赖而塌陷为 0（媒体控件不可见）。
       改用固定像素宽度撑开容器，再用 max-width: 100% 在窄屏下限制溢出。 */
    display: block;
    width: 280px;
    max-width: 100%;
}

.cm-file {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 100%;
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: currentColor;
    word-break: break-all;

    svg {
        flex-shrink: 0;
        width: 15px;
        height: 15px;
        opacity: 0.75;
    }
}

/* 发送状态做成气泡右下角的圆形角标：absolute 脱离文档流，
   状态出现/消失不撑高消息，也就不会扰动滚动位置（配合 ResizeObserver 的补滚更稳） */
.cm-status {
    position: absolute;
    right: -6px;
    bottom: -6px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--surface-solid, var(--surface-2));
    box-shadow: 0 0 0 1px var(--border);
    color: var(--text-2);
    line-height: 0;

    svg {
        width: 11px;
        height: 11px;
    }
}

/* 发送中：灰色旋转环 */
.cm-status-sending svg {
    animation: cm-spin 0.75s linear infinite;
}

/* 发送失败：红色角标，点击重试；hover 放大提示可点 */
.cm-status-failed {
    background: var(--danger);
    color: var(--danger-fg);
    box-shadow: 0 0 0 2px var(--surface-solid, var(--surface-2));
    cursor: pointer;
    transition: transform 0.12s ease;

    &:hover {
        transform: scale(1.15);
    }
    &:active {
        transform: scale(0.94);
    }
}

@keyframes cm-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
