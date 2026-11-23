import request from '@/plugin/axios'
import { cloneDeep, get } from 'lodash-es'

const Url:any = {
    'server': {
        'friend': '/friend',

    }
}

/// mock
const o = cloneDeep(Url.server)
Url['mock'] = {}
Object.entries(o).forEach(item => {
    Url['mock'][item[0]] = '/mock' + item[1]
})

const isMock = import.meta.env.VITE_APP_BUILD_MODE === 'true'

const requestServerName = isMock ? 'mock' : 'server'

export default {

    GetFriends() {
        return request({
            url: Url[requestServerName].friend,
            method: 'get',
        })
    },
    // 删除好友（后端按双向软删处理，对方列表会同步消失）
    RemoveFriend(id: string) {
        return request({
            url: `${Url[requestServerName].friend}/${id}`,
            method: 'delete',
        })
    },
}