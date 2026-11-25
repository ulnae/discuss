import { onMounted, onUnmounted } from 'vue'

export const usePaste = (uploadImage: Function, uploadFile: Function) => {
    function pasteListener(event: ClipboardEvent) {
        // 获取剪贴板数据
        const clipboardData = event.clipboardData || (window as any).clipboardData;
        if (!clipboardData) return;

        // 1. 直接获取文件列表（适用于从文件管理器复制的文件）
        // const files = clipboardData.files;
        // for (let i = 0; i < files.length; i++) {
        //     const file = files[i];
        //     console.log('粘贴的文件:', file.name, file.type, file.size);
        // }

        // 2. 遍历 items 列表（更精细地识别图片、文本等）
        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // 判断是否为文件类型（kind 为 "file"）
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (!file) continue;

                // 根据 MIME 类型判断是否为图片
                if (file.type.indexOf('image/') === 0) {
                    console.log('粘贴的图片文件:', file);
                    uploadImage(file)
                } else {
                    console.log('粘贴的其他文件:', file);
                    uploadFile(file)
                }
            }
            // 也可以处理文本类型（比如复制的 HTML 中包含图片）
            // else if (item.kind === 'string') {
            //     item.getAsString(function (str: string) {
            //         // 这里可以处理纯文本，但如果是图片的 base64 或 URL，则需要额外解析
            //         // 例如检查 str 是否为 data:image 或图片 URL
            //         if (str.startsWith('data:image/')) {
            //             // 将 base64 转换为 Blob 或 File
            //             const blob = dataURLtoBlob(str);
            //             const file = new File([blob], 'pasted-image.png', { type: blob.type });
            //             handleImage(file);
            //         }
            //     });
            // }
        }
    }






    onMounted(() => {
        console.log('paste-挂载')
        document.addEventListener('paste', pasteListener);

    })

    onUnmounted(() => {
        console.log('paste-销毁')
        document.removeEventListener('paste', pasteListener)
    })

    return {

    }
}


// 辅助函数：将 dataURL 转换为 Blob
function dataURLtoBlob(dataURL: string): Blob {
    const arr = dataURL.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Invalid data URL format');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

// 处理图片文件的函数示例（预览或上传）
function handleImage(file: File): void {
    // 预览
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = document.createElement('img');
        img.src = e.target?.result as string;
        document.body.appendChild(img); // 简单展示
    };
    reader.readAsDataURL(file);

    // 或者直接上传
    // uploadFile(file);
}