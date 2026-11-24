/*
 * 实时通话相关接口
 * 目前只有 ICE 配置：后端用长期 TURN Key 换短期凭证下发，前端不持有密钥
 */
import request from '@/plugin/axios'

const Url = {
    ice: '/rtc/ice',
}

export default {
    /** 获取 ICE 配置（含 Cloudflare TURN 短期凭证；未配置时后端降级返回 STUN） */
    GetIceServers() {
        return request({
            url: Url.ice,
            method: 'get',
        })
    },
}
