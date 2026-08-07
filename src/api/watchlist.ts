import { apiClient } from '@/lib/api-client'
import type { WatchlistItem } from '@/types/api'

export function listWatchlist() {
  return apiClient.get<WatchlistItem[]>('/v1/watchlist')
}

export function addToWatchlist(ticker: string, note?: string) {
  return apiClient.post<WatchlistItem>('/v1/watchlist', { ticker, note: note || undefined })
}

export function removeFromWatchlist(ticker: string) {
  return apiClient.delete<void>(`/v1/watchlist/${encodeURIComponent(ticker)}`)
}
