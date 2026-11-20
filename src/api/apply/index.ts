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

const Url: any = {
    'server': {
        'apply': '/apply', // 我发起的所有申请
        'applyMine': '/apply/mine', // 待我审批的申请（好友 + 入群统一）
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

    apply(data?: any) {
        return request({
            url: `${Url[requestServerName].apply}`,
            method: 'post',
            data
        })
    },
    getApply() {
        return request({
            url: `${Url[requestServerName].apply}`,
            method: 'get'
        })
    },
    // 处理申请
    handleApply(data?: any) {
        return request({
            url: `${Url[requestServerName].apply}/${data.id}`,
            method: 'PATCH',
            data
        })
    },
    // 待我审批的申请（好友 + 入群统一入口）
    GetApplyMine() {
        return request({
            url: `${Url[requestServerName].applyMine}`,
            method: 'get'
        })
    },
}