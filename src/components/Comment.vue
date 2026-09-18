<template>
    <img v-if="message.type === 'image'" :src="`${VITE_APP_API_BASE_URL}${message.content}`" alt="图片已失效"
        @click="handlePreviewImage(message.content)" class="max-h-24 max-w-sm rounded-md cursor-pointer" />
    <template v-else-if="message.type === 'file'">
        <video class="max-h-58 max-w-sm rounded-md cursor-pointer" controls
            v-if="isUrlEndWith(`${VITE_APP_API_BASE_URL}${message.content}`, ['mp4', 'webm'])">
            <source :src="`${VITE_APP_API_BASE_URL}${message.content}`">
        </video>
        <audio controls v-else-if="isUrlEndWith(`${VITE_APP_API_BASE_URL}${message.content}`, ['mp3', 'wav'])">
            <source :src="`${VITE_APP_API_BASE_URL}${message.content}`">
        </audio>
        <img v-else-if="isUrlEndWith(`${VITE_APP_API_BASE_URL}${message.content}`, ['svg', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'])"
            :src="`${VITE_APP_API_BASE_URL}${message.content}`" alt="图片已失效" @click="handlePreviewImage(message.content)"
            class="max-h-24 max-w-sm rounded-md cursor-pointer" />
        <a v-else class="text-blue-600/75 dark:text-blue-600 no-underline hover:underline"
            :href="`${VITE_APP_API_BASE_URL}${message.content}`" alt="" target="_blank">{{ message.originalname }}</a>
    </template>
    <span v-else class="whitespace-pre-wrap">
        {{ message.content }}
    </span>
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

<style lang="scss" scoped></style>