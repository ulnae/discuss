import { onBeforeUnmount, onMounted } from 'vue'

/**
 * 统一绑定隐藏 file input 的 change 事件：
 * - 支持异步回调
 * - 无论成功失败都清空 value，保证连续选择同一文件可再次触发
 * - 组件卸载时自动解绑，避免重复监听
 */
export function useFilePicker(
  inputId: string,
  onFile: (file: File) => void | Promise<void>
) {
  const getInput = () => document.getElementById(inputId) as HTMLInputElement | null

  const handleChange = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      await onFile(file)
    } finally {
      input.value = ''
    }
  }

  onMounted(() => getInput()?.addEventListener('change', handleChange))
  onBeforeUnmount(() => getInput()?.removeEventListener('change', handleChange))
}
