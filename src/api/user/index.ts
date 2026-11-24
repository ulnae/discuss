import request from '@/plugin/axios'

const Url = {
    'login': '/user/login',
    'register': '/user',
    'userSearch': '/user/search',
    'userUpload': '/user/upload',
    'GetCaptcha': '/captcha',
}

/**
 * Worker 后端没有 express-session，验证码答案由服务端落库、用 captchaId 关联。
 * nestjs 后端仍是 session 方案，captchaId 传过去会被忽略，所以这里统一带上即可。
 */
let captchaId = ''

const withCaptcha = (data?: any) => (captchaId ? { ...(data || {}), captchaId } : data)

export default {
    Login(data?:any) {
        return request({
            url: Url.login,
            method: 'post',
            data: withCaptcha(data)
        })
    },
    Register(data?:any) {
        return request({
            url: Url.register,
            method: 'post',
            data: withCaptcha(data)
        })
    },
    GetUserInfo(id?:string) {
        return request({
            url: `${Url.register}/${id}`,
            method: 'get'
        })
    },
    SearchUser(name?:string) {
        return request({
            url: `${Url.userSearch}?username=${name}`,
            method: 'get'
        })
    },
    UploadUser(data?:any) {
        return request({
            url: Url.userUpload,
            method: 'post',
            data,
            // 上传比常规接口慢，单独放宽超时
            timeout: 60 * 1000,
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
    },
    /** 更新本人资料：一次可改 username / email / password（改密码或邮箱需带 oldPassword） */
    UpdateUser(id: string, data?: any) {
        return request({
            url: `${Url.register}/${id}`,
            method: 'patch',
            data
        })
    },
    GetCaptcha() {
        return request({
            url: Url.GetCaptcha,
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