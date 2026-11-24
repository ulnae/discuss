import { useRouter } from 'vue-router'

/** 几个高频返回目标，避免各页面重复写路径字面量 */
export const NAV = {
  friendList: '/friend/dashboard',
  roomList: '/room/dashboard'
} as const

/** 在 setup 中调用：拿到一个返回指定页面的处理函数 */
export function useGoBack(path: string) {
  const router = useRouter()
  return () => router.push(path)
}
