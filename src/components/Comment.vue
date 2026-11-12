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
            <span>{{ message.originalname || '下载文件' }}</span>
        </a>
    </template>
    <span v-else class="cm-text">{{ message.content }}</span>
</template>

<script setup lang="ts">
import { isUrlEndWith } from "@/utils/index";

defineProps({
    message: {
        type: Object,
        required: true
    }
});

const VITE_APP_API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL
const handlePreviewImage = (url: string) => {
    window.open(`${VITE_APP_API_BASE_URL}${url}`);
}
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
    width: min(280px, 100%);
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

.cm-text {
    white-space: pre-wrap;
}
</style>
