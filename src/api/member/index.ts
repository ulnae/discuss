import request from '@/plugin/axios'
import { cloneDeep, get } from 'lodash-es'

const Url:any = {
    'server': {
        'member': '/member',


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

    GetMemberInfo(query?:any) {
        return request({
            url: `${Url[requestServerName].member}`,
            method: 'get',
            params: query
        })
    },
    RemoveMember(id:string) {
        return request({
            url: `${Url[requestServerName].member}/${id}`,
            method: 'delete',
        })
    }
}