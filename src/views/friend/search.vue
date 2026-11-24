<template>
    <SearchPage v-model.trim="username" title="添加好友" subtitle="输入用户名后回车，即可搜索并发送好友申请"
        placeholder="输入用户名" back-title="返回好友列表" :results="result" @back="goBack" @submit="handleSearch">
        <template #result="{ item }">
            <div class="result-card result-card--compact">
                <UserAvatar :name="item.username" size="lg" />
                <div class="result-main result-main--tight">
                    <div class="result-name result-name--with-chip">
                        {{ item.username }}
                        <span v-if="item.id === userStore.userInfo.id" class="chip">我</span>
                    </div>
                    <div class="result-meta">{{ item.email || '未设置邮箱' }}</div>
                </div>

                <button v-if="canAdd(item)" type="button" class="btn btn-primary btn-sm" @click="handleJoin(item.id)">
                    加好友
                </button>
                <span v-else-if="item.id !== userStore.userInfo.id" class="chip">已添加</span>
            </div>
        </template>
    </SearchPage>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import ServerApi from "@/api";
import type { User } from "@/store/modules/user";
import { useFriendStore } from "@/store/modules/friend";
import { useUserStore } from "@/store/modules/user";
import { toast } from "@/components/ui/toast";
import SearchPage from "@/components/SearchPage.vue";
import UserAvatar from "@/components/ui/UserAvatar.vue";

const router = useRouter()

/** 移动端搜索页是独立一屏，提供返回列表的入口 */
const goBack = () => router.push('/friend/dashboard')


const username = ref('')
const result = ref<User[]>([]);
const friendStore = useFriendStore()
const userStore = useUserStore()

const handleSearch = () => {
    if (!username.value) {
        toast.warning('请输入要搜索的用户名')
        return
    }
    ServerApi.SearchUser(username.value).then((res: any) => {
        if (res.code === 200) {
            result.value = res.data;
            if (!res.data?.length) toast.info('没有找到匹配的用户')
        }
    });
};

const canAdd = (item: User) => !!item.id && !friendStore.getFriendMap[item.id] && item.id !== userStore.userInfo.id

const handleJoin = (apply_user_id?: string) => {
    ServerApi.apply({ apply_user_id }).then((res: any) => {
        if (res.code === 200) {
            toast.success('好友申请已发送')
            username.value = ''
            result.value = []
        }
    })
};
</script>

