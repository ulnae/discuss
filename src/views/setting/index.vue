<template>
    <div class="w-full text-sm h-full relative px-2">
        <div class="w-full border border-gray-300 dark:border-gray-300/50 border-t-0 ">
            <div v-for="(item, k) in userStore.userInfo" :key="k" class="flex border-b border-gray-300 dark:border-gray-300/50 last:border-b-0">
                <div class="w-[130px] text-right border-r border-gray-300 dark:border-gray-300/50 p-2">{{ k }}:</div>
                <div class="flex-1 w-full auto-wrap p-2 pl-4">{{ item }}</div>
            </div>

            <div  class="flex border-b border-gray-300 dark:border-gray-300/50 last:border-b-0">
                <div class="w-[130px] text-right border-r border-gray-300 dark:border-gray-300/50 p-2">Time:</div>
                <div class="flex-1 w-full auto-wrap p-2 pl-4">{{__COMMIT_INFO__.time}}</div>
            </div>
            <div  class="flex border-b border-gray-300 dark:border-gray-300/50 last:border-b-0">
                <div class="w-[130px] text-right border-r border-gray-300 dark:border-gray-300/50 p-2">Author:</div>
                <div class="flex-1 w-full auto-wrap p-2 pl-4">{{__COMMIT_INFO__.author}}</div>
            </div>
            <div  class="flex border-b border-gray-300 dark:border-gray-300/50 last:border-b-0">
                <div class="w-[130px] text-right border-r border-gray-300 dark:border-gray-300/50 p-2">Commit:</div>
                <div class="flex-1 w-full auto-wrap p-2 pl-4">{{__COMMIT_INFO__.hash}}</div>
            </div>

            <div  class="flex border-b border-gray-300 dark:border-gray-300/50 last:border-b-0">
                <div class="w-[130px] text-right border-r border-gray-300 dark:border-gray-300/50 p-2">聊天记录:</div>
                <div class="flex-1 w-full auto-wrap p-2 pl-4 text-blue-600 cursor-pointer" @click="handleExport">导出</div>
            </div>
            <div  class="flex border-b border-gray-300 dark:border-gray-300/50 last:border-b-0">
                <div class="w-[130px] text-right border-r border-gray-300 dark:border-gray-300/50 p-2">聊天记录:</div>
                <div class="flex-1 w-full auto-wrap p-2 pl-4 text-blue-600 cursor-pointer" @click="handleImport">导入</div>
            </div>
        </div>
        <input class="hidden" id="chooseHistoryFile" type="file" accept="*.json">
    </div>
</template>
<script lang="ts" setup>
import { useUserStore } from '@/store/modules/user'
import { useDBStore } from '@/store/modules/database'
import { useSocketStore } from '@/store/modules/socket'
import { downloadJSON } from '@/utils/index'
import { onMounted, reactive } from 'vue'
import { sortBy, uniqWith, isEqual } from 'lodash-es';
const userStore = useUserStore()
const socketStore = useSocketStore()

const dbStore = useDBStore()

const __COMMIT_INFO__ = reactive({
    hash: __COMMIT_HASH__,
    author: __COMMIT_AUTHOR__,
    time: __COMMIT_TIME__
})
const handleExport = () => {
    console.log('export', dbStore)
    let _obj: any = {}
    dbStore.database?.iterate(function (value, key, iterationNumber) {
        // 此回调函数将对所有 key/value 键值对运行
        _obj[key] = Object.fromEntries(value as any)
    }).then(function () {
        console.log('Iteration has completed');
        downloadJSON(_obj, `${userStore.userInfo.id}.json`)
    }).catch(function (err) {
        // 当出错时，此处代码运行
        console.log(err);
    });
}

const handleImport = () => {
    document.getElementById('chooseHistoryFile')?.click()
}


onMounted(() => {
    document.getElementById('chooseHistoryFile')?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return;
        if (!file.name.startsWith(userStore.userInfo.id as string)) alert('请导入您自己的聊天记录');

        try {
            const text = await file.text(); // 读取文件内容为文本
            const { Room_Message, User_Message } = JSON.parse(text);   // 解析 JSON
            // 解析合并群聊天记录
            Object.entries(Room_Message).forEach(([key, value]: any) => {
                let roomMessage = socketStore.roomMessageMap.get(key)
                const unique = uniqWith([...(roomMessage as []), ...value], isEqual)
                socketStore.roomMessageMap.set(key, sortBy(unique, 'timestamp'))
            });
            // 解析合并好友聊天记录
            Object.entries(User_Message).forEach(([key, value]: any) => {
                let userMessage = socketStore.userMessageMap.get(key)
                const unique = uniqWith([...(userMessage as []), ...value], isEqual)
                socketStore.userMessageMap.set(key, sortBy(unique, 'timestamp'))
            });
        } catch (error) {
            console.error('解析失败:', error);
            alert('文件内容不是有效的 JSON 格式');
        }
    })

})

</script>
<style lang="scss">
.auto-wrap {
    word-wrap: break-word;
    /* 长单词换行 */
    word-break: break-word;
    /* 单词边界换行 */
    white-space: break-spaces;
    /* 空白符正常处理 */
}
</style>