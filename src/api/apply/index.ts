import request from '@/plugin/axios'

const Url = {
    'apply': '/apply', // 我发起的所有申请
    'applyMine': '/apply/mine', // 待我审批的申请（好友 + 入群统一）
}

export default {

    apply(data?: any) {
        return request({
            url: `${Url.apply}`,
            method: 'post',
            data
        })
    },
    getApply() {
        return request({
            url: `${Url.apply}`,
            method: 'get'
        })
    },
    // 处理申请
    handleApply(data?: any) {
        return request({
            url: `${Url.apply}/${data.id}`,
            method: 'PATCH',
            data
        })
    },
    // 待我审批的申请（好友 + 入群统一入口）
    GetApplyMine() {
        return request({
            url: `${Url.applyMine}`,
            method: 'get'
        })
    },
}