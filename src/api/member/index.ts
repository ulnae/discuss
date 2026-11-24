import request from '@/plugin/axios'

const Url = {
    'member': '/member',
}

export default {

    GetMemberInfo(query?:any) {
        return request({
            url: `${Url.member}`,
            method: 'get',
            params: query
        })
    },
    RemoveMember(id:string) {
        return request({
            url: `${Url.member}/${id}`,
            method: 'delete',
        })
    }
}