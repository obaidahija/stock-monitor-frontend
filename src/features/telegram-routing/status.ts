import type { TelegramCategory, TelegramStatusOut } from '@/types/api'

export function telegramCategoryStatus(status: TelegramStatusOut | undefined, category: TelegramCategory) {
  const route = status?.routes?.find((route) => route.category === category)
  if (!route) return status

  return { configured: route.source !== 'none', ready: route.ready, error: route.error }
}
