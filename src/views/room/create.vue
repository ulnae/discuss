<!--
 * @Author       : Eug yyh3531@163.com
 * @Date         : 2025-11-23 20:37:33
 * @LastEditors  : Eug yyh3531@163.com
 * @LastEditTime : 2025-11-23 23:18:46
 * @FilePath     : \e-talk\src\views\room\create.vue
 * @Description  : filename
 * 
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
-->
<template >
    <div class="flex flex-col items-center gap-4 h-full">
        <input type="text" placeholder="输入房间名" v-model.trim="room.name"
            class="w-1/2 rounded-md p-2 focus:bg-gray-200 dark:focus:bg-gray-200/50 focus:outline-none" />
        <textarea type="text" placeholder="输入房间描述" v-model.trim="room.description"
            class="w-1/2 rounded-md p-2 focus:bg-gray-200 dark:focus:bg-gray-200/50 focus:outline-none" rows="5" />

        <svg @click="handleCreate" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="size-6 cursor-pointer">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    </div>
</template>
<script lang="ts" setup>
import { reactive } from "vue";
import ServerApi from "@/api";
import { useRoomStore } from "@/store/modules/room";
const roomStore = useRoomStore()
const room = reactive({
    name: '',
    description: ''
})

const handleCreate = () => {
    if (!room.name || !room.description) return
    ServerApi.CreateRoom(room).then((res: any) => {
        if (res.code == 200) {
            room.description = ''
            room.name = ''
            roomStore.getRooms()
        }
    }).catch((err: any) => {
        console.log(err)
    })
}
</script>
<style lang="scss"></style>