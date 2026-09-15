<template lang="">
    <div class="dashboard p-2 h-full overflow-y-auto">
        <div 
            class="text-sm group gap-1 flex items-center animate__fadeIn animate__animated" 
            v-for="(item, idx) in alertStore.alerts" 
            :key="idx"
        >
            <span>[{{item.sender}}]：{{item.message}}</span>
            <svg @click="alertStore.alerts.splice(idx, 1)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 bg-gray-100 cursor-pointer hidden group-hover:block">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            <div class="flex-1 text-right hidden group-hover:block">{{ dayjs(item.timestamp).format('YYYY/MM/DD HH:mm:ss') }}</div>
        </div>
        <div class="fixed left-0 bottom-0 w-full text-center">{{dailyCountdown}}</div>
    </div>
</template>
<script setup lang="ts">
import { useAlertStore } from '@/store/modules/alert'
import { createDailyCountdown } from '@/utils/dailyCountdown'
import dayjs from 'dayjs';
import { onUnmounted,ref } from 'vue';
const alertStore = useAlertStore()


const times = ['12:00:00', '18:00:00'];
const dailyCountdown = ref('')
const stop = createDailyCountdown(times, (text:string) => {
    dailyCountdown.value = text
});
onUnmounted(stop)
</script>
<style lang="scss"></style>