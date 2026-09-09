import { apiClient } from '@/lib/api-client'
import type { MarketEventsOut, MarketEventsRefreshOut } from '@/types/api'

export function getMarketEvents(date?: string) {
  const query = date ? `?date=${date}` : ''
  return apiClient.get<MarketEventsOut>(`/v1/events${query}`)
}

export function refreshMarketEvents() {
  return apiClient.post<MarketEventsRefreshOut>('/v1/events/refresh')
}
