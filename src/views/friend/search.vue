<template>
    <SearchPage v-model.trim="username" :title="t('friend.addFriend')" :subtitle="t('friend.subtitle')"
        :placeholder="t('friend.usernamePh')" :back-title="t('friend.backToList')" :results="result" @back="goBack" @submit="handleSearch">
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

                <button v-if="canAdd(item)" type="button" class="btn btn-primary btn-sm" @click="handleJoin(item.id)">
                    {{ t('friend.addBtn') }}
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
const friendStore = useFriendStore()
const userStore = useUserStore()
const { t } = useI18n()

const handleSearch = () => {
    if (!username.value) {
        toast.warning(t('friend.inputRequired'))
        return
    }
    ServerApi.SearchUser(username.value).then((res: any) => {
        if (res.code === 200) {
            result.value = res.data;
            if (!res.data?.length) toast.info(t('friend.noMatch'))
        }
    });
};

const canAdd = (item: User) => !!item.id && !friendStore.getFriendMap[item.id] && item.id !== userStore.userInfo.id

const handleJoin = (apply_user_id?: string) => {
    ServerApi.apply({ apply_user_id }).then((res: any) => {
        if (res.code === 200) {
            toast.success(t('friend.requestSent'))
            username.value = ''
            result.value = []
        }
    })
};
</script>

