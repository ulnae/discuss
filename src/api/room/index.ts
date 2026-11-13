/*
 * @Author       : eug yyh3531@163.com
 * @Date         : 2022-08-31 15:08:14
 * @LastEditors  : Eug yyh3531@163.com
 * @LastEditTime : 2025-11-23 23:17:18
 * @FilePath     : \e-talk\src\api\room\index.ts
 * @Description  : filename
 * 
 * Copyright (c) 2023 by ${git_name_email}, All Rights Reserved. 
 */
import request from '@/plugin/axios'
import { Room } from '@/store/modules/room'
import { cloneDeep, get } from 'lodash-es'

const Url:any = {
    'server': {
        'roomMine': '/room/mine',
        'room': '/room',
        'roomSearch': '/room/search',
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

    GetRoomMine() {
        return request({
            url: Url[requestServerName].roomMine,
            method: 'get',
        })
    },
    // 登录/重连聚合拉取：我加入的房间 + 每房成员 + 每房在线名单（1 个请求替代 3+N 个）
    GetRoomOverview() {
        return request({
            url: `${Url[requestServerName].room}/overview`,
            method: 'get',
        })
    },
    CreateRoom(data:Room) {
        return request({
            url: Url[requestServerName].room,
            method: 'post',
            data
        })
    },
    GetRoomInfo(id?:string) {
        return request({
            url: `${Url[requestServerName].room}/${id}`,
            method: 'get'
        })
    },
    SearchRoom(name?:string) {
        return request({
            url: `${Url[requestServerName].roomSearch}?name=${name}`,
            method: 'get'
        })
    },
    // 解散房间（群主）；成员会实时收到 room:deleted
    DeleteRoom(id: string) {
        return request({
            url: `${Url[requestServerName].room}/${id}`,
            method: 'delete'
        })
    },
}