<template lang="">
    <div class="dashboard p-2 h-full overflow-y-auto relative">
        <div 
            class="text-sm group gap-1 flex items-center animate__fadeIn animate__animated" 
            v-for="(item, idx) in alertStore.alerts" 
            :key="idx"
        >
            <span>[{{item.sender}}]：{{item.message}}</span>
            <svg @click="alertStore.alerts.splice(idx, 1)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4 bg-gray-100 dark:bg-gray-100/50 cursor-pointer hidden group-hover:block">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            <div class="flex-1 text-right hidden group-hover:block">{{ dayjs(item.timestamp).format('YYYY/MM/DD HH:mm:ss') }}</div>
        </div>
        <Clock class="absolute right-2 bottom-2" :hours="clock.hours" :minutes="clock.minutes" :seconds="clock.seconds"/>
    </div>
</template>
<script setup lang="ts">
import { useAlertStore } from '@/store/modules/alert'
import { createDailyCountdown } from '@/utils/dailyCountdown'
import { Clock } from '@/components'
import dayjs from 'dayjs';
import { computed, onUnmounted, reactive, ref } from 'vue';
const alertStore = useAlertStore()


const times = ['12:00:00', '18:00:00'];
const clock = reactive({
    hours: '0',
    minutes: '0',
    seconds: '0',
})
const stop = createDailyCountdown(times, (data:any) => {
    Object.assign(clock,data)
});
onUnmounted(stop)
</script>
<style lang="scss"></style>