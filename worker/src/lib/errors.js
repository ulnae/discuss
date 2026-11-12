/** 业务异常：router 统一捕获后转成 { code:-1, msg, data:null } */
export class ApiError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

export const badRequest = (msg) => new ApiError(msg, 400);
export const unauthorized = (msg = '未授权，请登录') => new ApiError(msg, 401);
export const notFound = (msg = 'not found') => new ApiError(msg, 404);
export const notImplemented = (msg) => new ApiError(msg, 501);
