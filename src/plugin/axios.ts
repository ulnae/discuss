/* eslint-disable */
import axios, { AxiosInstance, AxiosPromise, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import NProgress from 'nprogress'
import { APIENUM, API_ENUM_SERVICE } from '@/settings'
import { useUserStore } from '@/store/modules/user'
import { pinia } from '@/store'
import { toast } from '@/components/ui/toast'
import { i18n } from '@/locales'

const t = i18n.global.t

let pendingRequests = 0

/** 请求开始时推进全局进度条；并发时只启动一次 */
function beginRequest() {
    pendingRequests++
    if (pendingRequests === 1) {
        NProgress.start()
    }
}

/** 请求结束时回退计数；全部完成后关闭进度条 */
function endRequest() {
    pendingRequests = Math.max(0, pendingRequests - 1)
    if (pendingRequests === 0) {
        NProgress.done()
    }
}

/**
 * 后端返回的 i18nKey（error.*）优先本地翻译；缺失时回退服务端原文（中文），
 * 保证旧版后端 / 未收录文案不至于显示成 key。
 */
function serverText(data: any): string | undefined {
    if (!data) return undefined
    const key = data.i18nKey
    if (typeof key === 'string' && key && i18n.global.te(key)) return t(key, data.i18nParams || {})
    const msg = data.msg || data.message
    return typeof msg === 'string' && msg.trim() ? msg.trim() : undefined
}

/** 把 axios 的原始报错整理成一句用户能看懂的话 */
function readableMessage(error: any): string {
    const response = error && error.response
    const fromServer = serverText(response && response.data)
    if (fromServer) return fromServer

    const status = response && response.status
    if (status && i18n.global.te(`http.${status}`)) return t(`http.${status}`)

    const raw = String((error && error.message) || '')
    if (error && (error.code === 'ECONNABORTED' || raw.includes('timeout'))) {
        return t('http.timeout')
    }
    if (raw === 'Network Error') return t('http.network')
    return raw || t('common.failedRetry')
}

// 创建一个错误
function errorCreate(msg: any, path: any) {
    const error = new Error(String(msg || t('common.failedRetry')))
    errorLog(error, path)
    throw error
}

// 记录并提示错误（统一走右上角小窗）
function errorLog(error: Error, path?: any) {
    // 打印到控制台
    if (import.meta.env.MODE === 'development') {
        console.log(error, path || 'Error')
    }
    toast.error(error.message || t('common.failedRetry'))
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

        if (useUserStore(pinia).getToken) {
            customConfig.headers['Authorization'] = `Bearer ${useUserStore().getToken}`
        }

        beginRequest()
        return customConfig
    },
    error => {
        // 发送失败
        console.log(error)
        endRequest()
        return Promise.reject(error)
    }
)

// 响应拦截器
service.interceptors.response.use(
    response => {
        // dataAxios 是 axios 返回数据中的 data
        const dataAxios: any = response.data
        endRequest()
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
                    errorCreate(serverText(dataAxios), response.config.url)
                    break
                case 204:
                    // [ 示例 ] 其它和后台约定的 code
                    errorCreate(serverText(dataAxios), response.config.url)
                    break
                case 401:
                    /// 需要去退出到登录页
                    // [ 示例 ] 其它和后台约定的 code
                    useUserStore().logout()
                    errorCreate(serverText(dataAxios), response.config.url)
                    break
                default:
                    // 不是正确的 code
                    errorCreate(serverText(dataAxios), response.config.url)
                    break
            }
        }
    },
    error => {
        endRequest()
        const status = error && error.response && error.response.status

        // 401：清掉本地登录态并回登录页（提示由 errorLog 统一弹出）
        if (status === 401) {
            useUserStore(pinia).logout()
        }

        error.message = readableMessage(error)
        errorLog(error)
        return Promise.reject(error)
    }
)

export default service