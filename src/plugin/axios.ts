/* eslint-disable */
import axios, { AxiosInstance, AxiosPromise, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { APIENUM, API_ENUM_SERVICE } from '@/settings'
import { useUserStore } from '@/store/modules/user'
import Cookies from 'js-cookie'
import { pinia } from '@/store'
import { toast } from '@/components/ui/toast'

/** HTTP 状态码兜底文案：后端没给 msg 时用它，避免把技术细节甩给用户 */
const HTTP_TIPS: Record<number, string> = {
    400: '请求参数有误，请检查后重试',
    401: '登录已过期，请重新登录',
    403: '没有权限执行该操作',
    404: '接口不存在或已被移除',
    408: '请求超时，请稍后重试',
    413: '内容过大，请压缩后重试',
    429: '操作太频繁了，请稍后再试',
    500: '服务器开小差了，请稍后重试',
    501: '该功能暂未开放',
    502: '网关异常，请稍后重试',
    503: '服务暂时不可用，请稍后重试',
    504: '网关超时，请稍后重试'
}

/** 把 axios 的原始报错整理成一句用户能看懂的话 */
function readableMessage(error: any): string {
    const response = error && error.response
    const data = response && response.data
    const serverMsg = data && (data.msg || data.message)
    if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg.trim()

    const status = response && response.status
    if (status && HTTP_TIPS[status]) return HTTP_TIPS[status]

    const raw = String((error && error.message) || '')
    if (error && (error.code === 'ECONNABORTED' || raw.includes('timeout'))) {
        return '请求超时，请检查网络后重试'
    }
    if (raw === 'Network Error') return '网络异常，请检查网络连接'
    return raw || '操作失败，请稍后重试'
}

// 创建一个错误
function errorCreate(msg: any, path: any) {
    const error = new Error(String(msg || '操作失败，请稍后重试'))
    errorLog(error, path)
    throw error
}

// 记录并提示错误（统一走右上角小窗）
function errorLog(error: Error, path?: any) {
    // 打印到控制台
    if (import.meta.env.MODE === 'development') {
        console.log(error, path || 'Error')
    }
    toast.error(error.message || '操作失败，请稍后重试')
}
interface RequestConfig extends AxiosRequestConfig {
    service?: APIENUM
    headers?: any
}
interface RuquestService extends AxiosInstance {
    (config: RequestConfig): AxiosPromise;
}
// 创建一个 axios 实例
const service: RuquestService = axios.create({
    withCredentials: true,
    baseURL: import.meta.env.VITE_APP_BASE_API,
    timeout: 15 * 1000, // 常规接口 15s 足够；上传等慢接口在各自请求里单独放宽
})

// interface ServiceRequestConfig extends AxiosRequestConfig {
//   service?: string
// }

/* eggjs 默认值，可修改 */
const xsrfCookieName = 'csrfToken';
const xsrfHeaderName = 'x-csrf-token';
// 请求拦截器
service.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Cast config to any to allow custom properties like service
        const customConfig = config as InternalAxiosRequestConfig & { service?: APIENUM };
        if (customConfig.service) {
            customConfig.baseURL = API_ENUM_SERVICE[customConfig.service]
        }
        // 在请求发送之前做一些处理
        // 让每个请求携带token-- ['X-Token']为自定义key 请根据实际情况自行修改
        customConfig.headers['Base-Version'] = import.meta.env.VITE_APP_VERSION
        // console.log(import.meta.env.VITE_APP_VERSION,'baseURL')

        /* header 中添加 csrfToken */
        customConfig.headers[xsrfHeaderName] = Cookies.get(xsrfCookieName);
        if (useUserStore(pinia).getToken) {
            customConfig.headers['Authorization'] = `Bearer ${useUserStore().getToken}`
        }

        return customConfig
    },
    error => {
        // 发送失败
        console.log(error)
        return Promise.reject(error)
    }
)

// 响应拦截器
service.interceptors.response.use(
    response => {
        // dataAxios 是 axios 返回数据中的 data
        const dataAxios: any = response.data
        // 这个状态码是和后端约定的
        const { code } = dataAxios
        // console.log(code,'code');

        // 根据 code 进行判断
        if (code === undefined) {
            // 如果没有 code 代表这不是项目后端开发的接口 
            return dataAxios
        } else {
            // 有 code 代表这是一个后端接口 可以进行进一步的判断
            switch (code) {
                case 200:
                    return dataAxios
                case 0:
                    return dataAxios.data
                case 403:
                    // [ 示例 ] 其它和后台约定的 code
                    errorCreate(dataAxios.msg, response.config.url)
                    break
                case 204:
                    // [ 示例 ] 其它和后台约定的 code
                    errorCreate(dataAxios.msg, response.config.url)
                    break
                case 401:
                    /// 需要去退出到登录页
                    // [ 示例 ] 其它和后台约定的 code
                    useUserStore().logout()
                    errorCreate(dataAxios.msg, response.config.url)
                    break
                default:
                    // 不是正确的 code
                    errorCreate(dataAxios.msg, response.config.url)
                    break
            }
        }
    },
    error => {
        const status = error && error.response && error.response.status

        // 401：清掉本地登录态并回登录页（提示由 errorLog 统一弹出）
        if (status === 401 && import.meta.env.VITE_APP_BUILD_MODE !== 'true') {
            useUserStore(pinia).logout()
        }

        error.message = readableMessage(error)
        errorLog(error)
        return Promise.reject(error)
    }
)

export default service