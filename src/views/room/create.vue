<template>
    <div class="create-page">
        <BackButton class="page-back" :title="t('room.backToList')" @click="goBack" />
        <div class="create-card">
            <header class="create-head">
                <div class="create-logo" aria-hidden="true">
                    <AppIcon name="room" :size="20" />
                </div>
                <h1 class="create-title">{{ t('room.createRoom') }}</h1>
                <p class="create-sub">{{ t('room.createSubtitle') }}</p>
            </header>

            <div class="create-form">
                <label class="field">
                    <span class="ui-label">{{ t('room.nameLabel') }}</span>
                    <div class="ui-field">
                        <span class="ui-field-icon">
                            <AppIcon name="house" :size="15" />
                        </span>
                        <input v-model.trim="room.name" type="text" :placeholder="t('room.namePlaceholder')" />
                    </div>
                </label>

                <label class="field">
                    <span class="ui-label">{{ t('room.descLabel') }}</span>
                    <div class="ui-field ui-field-area">
                        <textarea v-model.trim="room.description" rows="5" :placeholder="t('room.descPlaceholder')"></textarea>
                    </div>
                </label>

                <button type="button" class="btn btn-primary btn-block"
                    :disabled="!room.name || !room.description || creating" @click="handleCreate">
                    {{ creating ? t('room.creating') : t('room.createRoom') }}
                </button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from "vue";
import ServerApi from "@/api";
import { useI18n } from 'vue-i18n';
import { useRoomStore } from "@/store/modules/room";
import { NAV, useGoBack } from "@/utils/nav";
import { toast } from "@/components/ui/toast";
import { AppIcon, BackButton } from '@/components/ui'


const roomStore = useRoomStore()
const { t } = useI18n()

/** 移动端创建页是独立一屏，提供返回列表的入口 */
const goBack = useGoBack(NAV.roomList)
const room = reactive({
    name: '',
    description: ''
})
/** 创建请求在途：按钮禁用，防连点重复建群 */
const creating = ref(false)

const handleCreate = () => {
    if (creating.value) return
    if (!room.name || !room.description) {
        toast.warning(t('room.warnRequired'))
        return
    }
    creating.value = true
    ServerApi.CreateRoom(room).then((res: any) => {
        if (res.code == 200) {
            toast.success(t('room.created'))
            room.description = ''
            room.name = ''
            roomStore.getRooms()
        }
    }).catch(() => {
        // 错误提示由 axios 拦截器统一处理
    }).finally(() => {
        creating.value = false
    })
}
</script>

<style lang="scss" scoped>
.create-page {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 1.5rem 1.25rem;
    overflow-y: auto;
}

/* 移动端返回按钮（.back-btn 全局只在窄屏显示） */
.page-back {
    position: absolute;
    top: 0.6rem;
    left: 0.6rem;
}

.create-card {
    width: min(400px, 100%);
    padding: 1.9rem 1.75rem 1.6rem;
    border-radius: var(--radius-xl);
    background: var(--surface-solid);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-card);
    animation: create-in 0.45s var(--ease) both;
}

@keyframes create-in {
    from {
        opacity: 0;
        transform: translateY(12px) scale(0.99);
    }

    to {
        opacity: 1;
        transform: none;
    }
}

.create-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 1.35rem;
}

.create-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    margin-bottom: 0.85rem;
    border-radius: 13px;
    color: var(--brand-fg);
    background: var(--brand-bg);
    box-shadow: var(--brand-shadow);
}

.create-title {
    font-size: 1.2rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--text);
}

.create-sub {
    margin-top: 0.3rem;
    font-size: 0.76rem;
    color: var(--text-2);
}

.create-form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
}

.create-form .btn {
    margin-top: 0.2rem;
}

@media (prefers-reduced-motion: reduce) {
    .create-card {
        animation: none;
    }
}
</style>
