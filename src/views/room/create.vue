<template>
    <div class="create-page">
        <div class="create-card">
            <header class="create-head">
                <div class="create-logo" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.25 8.5c.9.3 1.5 1.1 1.5 2.1v4.3c0 1.1-.8 2.1-2 2.2l-1 .1v3l-3-3c-1.4 0-2.7-.1-4-.2" />
                        <path d="M16.5 6.6c0-1.6-1.2-3.1-2.8-3.3A48 48 0 0 0 5 3.4C3.4 3.6 2.2 5 2.2 6.6v6.2c0 1.6 1.2 3.1 2.8 3.3L7 16.2V21l4.2-4.2" />
                    </svg>
                </div>
                <h1 class="create-title">创建房间</h1>
                <p class="create-sub">起个名字，拉上朋友一起聊</p>
            </header>

            <div class="create-form">
                <label class="field">
                    <span class="ui-label">房间名</span>
                    <div class="ui-field">
                        <span class="ui-field-icon">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 10.5 12 3l9 7.5" />
                                <path d="M5 9.8V20a1 1 0 0 0 1 1h4v-5a2 2 0 0 1 4 0v5h4a1 1 0 0 0 1-1V9.8" />
                            </svg>
                        </span>
                        <input v-model.trim="room.name" type="text" placeholder="例如：深夜代码局" />
                    </div>
                </label>

                <label class="field">
                    <span class="ui-label">房间描述</span>
                    <div class="ui-field ui-field-area">
                        <textarea v-model.trim="room.description" rows="5" placeholder="简单介绍一下这个房间聊什么"></textarea>
                    </div>
                </label>

                <button type="button" class="btn btn-primary btn-block"
                    :disabled="!room.name || !room.description" @click="handleCreate">
                    创建房间
                </button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { reactive } from "vue";
import ServerApi from "@/api";
import { useRoomStore } from "@/store/modules/room";
import { toast } from "@/components/ui/toast";
const roomStore = useRoomStore()
const room = reactive({
    name: '',
    description: ''
})

const handleCreate = () => {
    if (!room.name || !room.description) {
        toast.warning('请填写房间名和描述')
        return
    }
    ServerApi.CreateRoom(room).then((res: any) => {
        if (res.code == 200) {
            toast.success('房间创建成功')
            room.description = ''
            room.name = ''
            roomStore.getRooms()
        }
    }).catch((err: any) => {
        console.log(err)
    })
}
</script>

<style lang="scss" scoped>
.create-page {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 1.5rem 1.25rem;
    overflow-y: auto;
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
    color: var(--accent-fg);
    background: var(--accent);
    box-shadow: var(--shadow-accent);
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
