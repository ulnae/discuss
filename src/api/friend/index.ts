import request from '@/plugin/axios'

const Url = {
    'friend': '/friend',
}

export default {

    GetFriends() {
        return request({
            url: Url.friend,
            method: 'get',
        })
    },
    // 删除好友（后端按双向软删处理，对方列表会同步消失）
    RemoveFriend(id: string) {
        return request({
            url: `${Url.friend}/${id}`,
            method: 'delete',
        })
    },
}