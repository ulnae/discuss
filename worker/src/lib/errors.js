/** 业务异常：router 统一捕获后转成 { code:-1, msg, data:null }（带 i18nKey 时前端按 key 显示多语言） */
export class ApiError extends Error {
    constructor(message, status = 400, i18nKey = null, i18nParams = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        if (i18nKey) this.i18nKey = i18nKey;
        if (i18nParams) this.i18nParams = i18nParams;
    }
}

export const badRequest = (msg, i18nKey = null, i18nParams = null) => new ApiError(msg, 400, i18nKey, i18nParams);
export const unauthorized = (msg = '未授权，请登录', i18nKey = 'error.auth.notLoggedIn') => new ApiError(msg, 401, i18nKey);
export const notFound = (msg = 'not found') => new ApiError(msg, 404);
export const notImplemented = (msg) => new ApiError(msg, 501);
