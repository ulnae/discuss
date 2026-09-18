<template lang="">
    <div class="apply px-2 flex gap-2 h-full">
      <div class="flex-1 border-l border-r border-gray-300 dark:border-gray-300/50">
        <div class="border-b border-gray-300 dark:border-gray-300/50 text-center py-2">待处理申请</div>
        <div v-if="applyStore.pendingApplies.length > 0" class="p-2">
            <div v-for="item in applyStore.pendingApplies" :key="item.id" class="flex justify-around py-2 hover:bg-gray-200 dark:hover:bg-gray-200/50">
                <div>{{item.user_info.username}} 申请加为好友</div>
                <div v-if="!item.handle_status" class="flex gap-4">
                    <!-- 同意 -->
                    <button @click="applyStore.handleApply(item.id, true)" class="cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </button>
                    <!-- 拒绝 -->
                    <button @click="applyStore.handleApply(item.id, false)" class="cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>

                    </button>
                </div>

                <div v-else>
                  {{item.status ? '已同意' : '已拒绝'}}
                </div>

            </div>
        </div>
        <div v-else class="p-2 ">
            <div  class="text-center py-2 hover:bg-gray-200 dark:hover:bg-gray-200/50 text-center">
                暂无申请
            </div>
        </div>
      </div>

      <div class="flex-1 border-l border-r border-gray-300 dark:border-gray-300/50">
          <div class="border-b border-gray-300 dark:border-gray-300/50 text-center py-2">我发起的所有申请</div>
          <div v-if="applyStore.applies.length > 0" class="p-2">
            <div v-for="item in applyStore.applies" :key="item.id" class="flex gap-10 py-2 hover:bg-gray-200 dark:hover:bg-gray-200/50">
              <div v-if="item.room_id" class="flex-1 text-right">
                申请加入房间 {{item.room_info.name}}
              </div>
              <div v-else class="flex-1 text-right">
                申请加 {{item.apply_user_info.username}} 为好友
              </div>

              <span v-if="item.handle_status" class="flex-1 text-left">{{item.status ? '已同意' : '已拒绝'}}</span>
              <span v-else class="flex-1 text-left">待处理</span>
            </div>
          </div>
          <div v-else class="p-2 ">
              <div class="text-center py-2 hover:bg-gray-200 dark:hover:bg-gray-200/50 text-center">
                  暂无申请
              </div>
          </div>
      </div>
    </div>
</template>
<script setup lang="ts">
import { useApplyStore } from "@/store/modules/apply";

const applyStore = useApplyStore();
applyStore.getPendingApplies()
applyStore.getApplies()
</script>
<style lang="">
</style>