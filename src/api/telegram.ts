import { apiClient } from '@/lib/api-client'
import type {
  TelegramCategory,
  TelegramRouteIn,
  TelegramRouteOut,
  TelegramStatusOut,
  TopicSetupOut,
} from '@/types/api'

const BASE = '/v1/notifications/telegram'

export function getTelegramRoutingStatus() {
  return apiClient.get<TelegramStatusOut>(`${BASE}/status`)
}

export function saveTelegramRoute(category: TelegramCategory, body: TelegramRouteIn) {
  return apiClient.put<TelegramRouteOut>(`${BASE}/routes/${category}`, body)
}

export function clearTelegramRoute(category: TelegramCategory) {
  return apiClient.delete<void>(`${BASE}/routes/${category}`)
}

export function sendTelegramCategoryTest(category: TelegramCategory) {
  return apiClient.post<{ sent: boolean }>(`${BASE}/test?category=${category}`)
}

/** Blank uses the backend's default chat (TELEGRAM_CHAT_ID). */
export function setupTelegramTopics(chatId?: string) {
  return apiClient.post<TopicSetupOut>(`${BASE}/setup-topics`, chatId ? { chat_id: chatId } : {})
}
