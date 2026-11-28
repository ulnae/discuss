<template>
    <SearchPage v-model.trim="username" :title="t('friend.addFriend')" :subtitle="t('friend.subtitle')"
        :placeholder="t('friend.usernamePh')" :back-title="t('friend.backToList')" :results="result" :loading="searching" @back="goBack" @submit="handleSearch">
        <template #result="{ item }">
            <div class="result-card result-card--compact">
                <UserAvatar :name="item.username" size="lg" />
                <div class="result-main result-main--tight">
                    <div class="result-name result-name--with-chip">
                        {{ item.username }}
                        <span v-if="item.id === userStore.userInfo.id" class="chip">{{ t('friend.me') }}</span>
                    </div>
                    <div class="result-meta">{{ item.email || t('friend.noEmail') }}</div>
                </div>

                <button v-if="canAdd(item)" type="button" class="btn btn-primary btn-sm"
                    :disabled="applyingId === item.id" @click="handleJoin(item.id)">
                    {{ applyingId === item.id ? t('friend.applying') : t('friend.addBtn') }}
                </button>
                <span v-else-if="item.id !== userStore.userInfo.id" class="chip chip-success">{{ t('friend.added') }}</span>
            </div>
        </template>
    </SearchPage>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import ServerApi from "@/api";
import { NAV, useGoBack } from "@/utils/nav";
import type { User } from "@/store/modules/user";
import { useFriendStore } from "@/store/modules/friend";
import { useUserStore } from "@/store/modules/user";
import { toast } from "@/components/ui/toast";
import { SearchPage } from '@/components'

import { UserAvatar } from '@/components/ui'


/** 移动端搜索页是独立一屏，提供返回列表的入口 */
const goBack = useGoBack(NAV.friendList)


const username = ref('')
const result = ref<User[]>([]);
/** 搜索中：控制按钮禁用与 loading 展示 */
const searching = ref(false);
/** 自增序号守卫：只接受最后一次搜索的回包，避免竞态覆盖 */
let searchId = 0;
/** 正在发送的好友申请（一次只处理一个，防连点重复 POST /apply） */
const applyingId = ref<string | null>(null);
const friendStore = useFriendStore()
const userStore = useUserStore()
const { t } = useI18n()

const handleSearch = () => {
    if (!username.value) {
        toast.warning(t('friend.inputRequired'))
        return
    }
    const id = ++searchId;
    searching.value = true;
    ServerApi.SearchUser(username.value).then((res: any) => {
        if (id === searchId) {
            if (res.code === 200) {
                result.value = res.data;
                if (!res.data?.length) toast.info(t('friend.noMatch'))
            }
        }
    }).catch(() => {
        // 错误提示由 axios 拦截器统一处理
    }).finally(() => {
        if (id === searchId) searching.value = false;
    });
};

const canAdd = (item: User) => !!item.id && !friendStore.getFriendMap[item.id] && item.id !== userStore.userInfo.id

const handleJoin = (apply_user_id?: string) => {
    if (!apply_user_id || applyingId.value) return
    applyingId.value = apply_user_id
    ServerApi.apply({ apply_user_id }).then((res: any) => {
        if (res.code === 200) {
            toast.success(t('friend.requestSent'))
            username.value = ''
            result.value = []
        }
    }).catch(() => {
        // 错误提示由 axios 拦截器统一处理
    }).finally(() => {
        applyingId.value = null
    })
};
</script>

