import { apiClient } from '@/lib/api-client'
import type { MarketAssetsOut } from '@/types/api'

/** Reads the saved Yahoo capture; never requests new provider quotes. */
export function getMarketAssets() {
  return apiClient.get<MarketAssetsOut>('/v1/market-assets')
}

/** Fetch fresh provider quotes and persist the resulting capture. */
export function refreshMarketAssets() {
  return apiClient.post<MarketAssetsOut>('/v1/market-assets/refresh')
}

export type AssetHistoryPeriod = '1mo' | '3mo' | '1y'
export interface AssetHistoryPoint {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number
  volume: number | null
}
export interface AssetHistory {
  symbol: string
  period: AssetHistoryPeriod
  points: AssetHistoryPoint[]
}
export function getMarketAssetHistory(symbol: string, period: AssetHistoryPeriod) {
  const params = new URLSearchParams({ symbol, period })
  return apiClient.get<AssetHistory>(`/v1/market-assets/history?${params}`)
}
