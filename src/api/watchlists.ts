import { apiClient } from '@/lib/api-client'
import type {
  WatchlistItemOut,
  WatchlistEventComparison,
  WatchlistEventOut,
  WatchlistMembershipOut,
  WatchlistOut,
  WatchlistSetupHorizon,
  WatchlistSetupOut,
  WatchlistSetupSide,
  WatchlistSetupLevel,
  TelegramStatusOut,
} from '@/types/api'

export type PriceEventConditionInput =
  | {
      kind: 'custom'
      comparison: WatchlistEventComparison
      threshold_price: number
    }
  | {
      kind: 'setup_level'
      setup_id: number
      level: WatchlistSetupLevel
    }

export interface WatchlistEventInput {
  event_type?: 'price_threshold'
  condition: PriceEventConditionInput
  message?: string
}

export interface SetupTimingInput {
  side: WatchlistSetupSide
  horizon: WatchlistSetupHorizon
  expires_on?: string
}

export interface ManualSetupInput extends SetupTimingInput {
  watchlist_id: number
  ticker: string
  entry_primary: number
  entry_secondary?: number
  stop_loss: number
  take_profit: number
  note?: string
  replace_existing?: boolean
}

export interface AiSetupInput {
  ticker: string
  snapshot_id: number
  watchlist_ids: number[]
  horizon: WatchlistSetupHorizon
  expires_on?: string
}

export interface SetupUpdateInput {
  side?: WatchlistSetupSide
  horizon?: WatchlistSetupHorizon
  expires_on?: string
  entry_primary?: number
  entry_secondary?: number
  clear_entry_secondary?: boolean
  stop_loss?: number
  take_profit?: number
  note?: string | null
}

export function getWatchlists(ticker?: string) {
  const query = ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''
  return apiClient.get<WatchlistOut[]>(`/v1/watchlists${query}`)
}

export function createWatchlist(name: string) {
  return apiClient.post<WatchlistOut>('/v1/watchlists', { name })
}

export function renameWatchlist(id: number, name: string) {
  return apiClient.patch<WatchlistOut>(`/v1/watchlists/${id}`, { name })
}

export function deleteWatchlist(id: number) {
  return apiClient.delete<void>(`/v1/watchlists/${id}`)
}

export function getWatchlistItems(id: number) {
  return apiClient.get<WatchlistItemOut[]>(`/v1/watchlists/${id}/items`)
}

export function getTickerMemberships(ticker: string) {
  return apiClient.get<WatchlistMembershipOut[]>(
    `/v1/watchlists/memberships/${encodeURIComponent(ticker)}`,
  )
}

export function addWatchlistItem(watchlistId: number, ticker: string) {
  return apiClient.put<WatchlistMembershipOut>(
    `/v1/watchlists/${watchlistId}/items/${encodeURIComponent(ticker)}`,
  )
}

export function removeWatchlistItem(watchlistId: number, ticker: string) {
  return apiClient.delete<void>(
    `/v1/watchlists/${watchlistId}/items/${encodeURIComponent(ticker)}`,
  )
}

export function createManualSetup(body: ManualSetupInput) {
  return apiClient.post<WatchlistSetupOut>('/v1/watchlists/setups/manual', body)
}

export function createAiSetups(body: AiSetupInput) {
  return apiClient.post<WatchlistSetupOut[]>('/v1/watchlists/setups/ai', body)
}

export function updateWatchlistSetup(id: number, body: SetupUpdateInput) {
  return apiClient.patch<WatchlistSetupOut>(`/v1/watchlists/setups/${id}`, body)
}

export function getSetupHistory(itemId: number) {
  return apiClient.get<WatchlistSetupOut[]>(`/v1/watchlists/items/${itemId}/setups`)
}

export function cloneSetup(id: number, body: SetupTimingInput & { replace_existing?: boolean }) {
  return apiClient.post<WatchlistSetupOut>(`/v1/watchlists/setups/${id}/clone`, body)
}

export function getWatchlistEvents(itemId: number) {
  return apiClient.get<WatchlistEventOut[]>(`/v1/watchlists/items/${itemId}/events`)
}

export function createWatchlistEvent(itemId: number, body: WatchlistEventInput) {
  return apiClient.post<WatchlistEventOut>(`/v1/watchlists/items/${itemId}/events`, body)
}

export function updateWatchlistEvent(id: number, body: WatchlistEventInput) {
  return apiClient.put<WatchlistEventOut>(`/v1/watchlists/events/${id}`, body)
}

export function rearmWatchlistEvent(id: number, body: WatchlistEventInput) {
  return apiClient.post<WatchlistEventOut>(`/v1/watchlists/events/${id}/rearm`, body)
}

export function deleteWatchlistEvent(id: number) {
  return apiClient.delete<void>(`/v1/watchlists/events/${id}`)
}

export function retryWatchlistEventDelivery(id: number) {
  return apiClient.post<WatchlistEventOut>(`/v1/watchlists/events/${id}/retry-delivery`)
}

export function getTelegramStatus() {
  return apiClient.get<TelegramStatusOut>('/v1/notifications/telegram/status')
}

export function sendTelegramTest() {
  return apiClient.post<{ sent: boolean }>('/v1/notifications/telegram/test')
}
