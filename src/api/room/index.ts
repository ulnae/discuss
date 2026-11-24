import request from '@/plugin/axios'
import type { Room } from '@/store/modules/room'

const Url = {
    'room': '/room',
    'roomSearch': '/room/search',
}

export default {

    // 登录/重连聚合拉取：我加入的房间 + 每房成员 + 每房在线名单（1 个请求替代 3+N 个）
    GetRoomOverview() {
        return request({
            url: `${Url.room}/overview`,
            method: 'get',
        })
    },
    CreateRoom(data:Room) {
        return request({
            url: Url.room,
            method: 'post',
            data
        })
    },
    SearchRoom(name?:string) {
        return request({
            url: `${Url.roomSearch}?name=${name}`,
            method: 'get'
        })
    },
    // 解散房间（群主）；成员会实时收到 room:deleted
    DeleteRoom(id: string) {
        return request({
            url: `${Url.room}/${id}`,
            method: 'delete'
        })
    },
}