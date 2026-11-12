/**
 * 上传前的图片压缩
 *
 * 免费额度只有 10GB，原图（手机 3–5MB）会让容量直接少一个数量级。
 * 统一压到长边 1920、quality 0.82，实际通常 200–500KB，聊天窗显示足够。
 * GIF 保留原样（否则动图会丢帧），已经小于 300KB 的也不处理。
 */
export async function compressImage(file: Blob, maxSide = 1920, quality = 0.82): Promise<Blob> {
    if (!file.type.startsWith('image/')) return file
    if (file.type === 'image/gif') return file
    if (file.size <= 300 * 1024) return file

    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return file

        ctx.drawImage(bitmap, 0, 0, width, height)
        bitmap.close?.()

        /* PNG 保留透明通道，其余统一转 JPEG 换取体积 */
        const isPng = file.type === 'image/png'
        const outType = isPng ? 'image/webp' : 'image/jpeg'
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, outType, quality))
        if (!blob) return file
        return blob.size < file.size ? blob : file
    } catch {
        return file
    }
}

/** 压缩后补一个带扩展名的文件名，服务端据此判断类型 */
export function imageFilename(blob: Blob): string {
    const ext = blob.type === 'image/png' ? 'png'
        : blob.type === 'image/webp' ? 'webp'
            : blob.type === 'image/gif' ? 'gif'
                : 'jpg'
    return `image-${Date.now()}.${ext}`
}
