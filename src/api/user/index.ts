/*
 * @Author       : eug yyh3531@163.com
 * @Date         : 2022-08-31 15:08:14
 * @LastEditors  : Eug yyh3531@163.com
 * @LastEditTime : 2025-11-23 22:47:08
 * @FilePath     : \e-talk\src\api\user\index.ts
 * @Description  : filename
 * 
 * Copyright (c) 2023 by ${git_name_email}, All Rights Reserved. 
 */
import request from '@/plugin/axios'
import { cloneDeep, get } from 'lodash-es'

const Url:any = {
    'server': {
        'login': '/user/login',
        'register': '/user',
        'userSearch': '/user/search',
        'userUpload': '/user/upload',
        'GetCaptcha': '/captcha',


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

/**
 * Worker 后端没有 express-session，验证码答案由服务端落库、用 captchaId 关联。
 * nestjs 后端仍是 session 方案，captchaId 传过去会被忽略，所以这里统一带上即可。
 */
let captchaId = ''

const withCaptcha = (data?: any) => (captchaId ? { ...(data || {}), captchaId } : data)

export default {
    Login(data?:any) {
        return request({
            url: Url[requestServerName].login,
            method: 'post',
            data: withCaptcha(data)
        })
    },
    Register(data?:any) {
        return request({
            url: Url[requestServerName].register,
            method: 'post',
            data: withCaptcha(data)
        })
    },
    GetUserInfo(id?:string) {
        return request({
            url: `${Url[requestServerName].register}/${id}`,
            method: 'get'
        })
    },
    SearchUser(name?:string) {
        return request({
            url: `${Url[requestServerName].userSearch}?username=${name}`,
            method: 'get'
        })
    },
    UploadUser(data?:any) {
        return request({
            url: Url[requestServerName].userUpload,
            method: 'post',
            data,
            // 上传比常规接口慢，单独放宽超时
            timeout: 60 * 1000,
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
    },
    GetCaptcha() {
        return request({
            url: Url[requestServerName].GetCaptcha,
            method: 'get'
        }).then((res: any) => {
            // worker：{ code:200, msg, data:{ id, svg } }
            if (res && typeof res === 'object' && res.data && typeof res.data === 'object' && res.data.svg) {
                captchaId = res.data.id
                return res.data.svg
            }
            // nestjs：直接返回裸 SVG 字符串
            return res
        })
    }
}