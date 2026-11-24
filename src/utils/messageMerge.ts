import type { ChatMessage } from '@/constants/events'

/** 消息业务主键：优先 clientId（乐观消息与回执对账），其次 id，最后兜底 */
const messageKey = (message: ChatMessage) =>
  message.clientId || message.id || `${message.from}-${message.timestamp}`

/** 合并两批聊天消息：去重后按时间升序，后出现的同主键消息覆盖旧消息 */
export function mergeChatMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const map = new Map<string, ChatMessage>()
  for (const item of [...existing, ...incoming]) {
    const message = { ...item }
    message.id = message.id || message.clientId || `${message.from}-${message.timestamp}`
    map.set(messageKey(message), message)
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp)
}

/** 通知去重口径：发送人 + 时间 + 内容 */
const alertKey = (alert: { senderName?: string; timestamp: number; message?: string }) =>
  `${alert.senderName}-${alert.timestamp}-${alert.message}`

/** 合并系统通知：去重后按时间降序（最新在上） */
export function mergeAlerts<T extends { senderName?: string; timestamp: number; message?: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>()
  for (const item of [...existing, ...incoming]) map.set(alertKey(item), item)
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp)
}
