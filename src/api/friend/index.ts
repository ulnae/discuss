/*
 * @Author       : eug yyh3531@163.com
 * @Date         : 2022-08-31 15:08:14
 * @LastEditors  : eug yyh3531@163.com
 * @LastEditTime : 2023-08-03 15:16:59
 * @FilePath     : /micro-vue/src/api/user/index.ts
 * @Description  : filename
 * 
 * Copyright (c) 2023 by ${git_name_email}, All Rights Reserved. 
 */
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