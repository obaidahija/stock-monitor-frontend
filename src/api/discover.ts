import { apiClient } from '@/lib/api-client'
import type {
  EarningsResult,
  FilingOut,
  SectorHeatmapOut,
  TickerSearchResult,
  TrackedTickerOut,
  TrendingSocialOut,
  TwitterBestStocksOut,
  TwitterBestStocksRefreshOut,
  UniverseTickerOut,
} from '@/types/api'

export function getNotableFilings() {
  return apiClient.get<FilingOut[]>('/v1/discover/filings')
}

export interface UniverseParams {
  sort?: 'score' | 'ticker' | 'added_at' | 'next_earnings_date' | 'change_pct' | 'volume_ratio'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
  manualOnly?: boolean
  twitterMonitoredOnly?: boolean
  earningsResult?: EarningsResult
  minGapPct?: number
  minVolumeRatio?: number
  sector?: string
}

export interface UniversePage {
  items: UniverseTickerOut[]
  total: number
}

export async function getUniverse(params: UniverseParams = {}): Promise<UniversePage> {
  const qs = new URLSearchParams()
  if (params.sort) qs.set('sort', params.sort)
  if (params.order) qs.set('order', params.order)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  if (params.manualOnly !== undefined) qs.set('manual_only', String(params.manualOnly))
  if (params.twitterMonitoredOnly !== undefined) {
    qs.set('twitter_monitored_only', String(params.twitterMonitoredOnly))
  }
  if (params.earningsResult) qs.set('earnings_result', params.earningsResult)
  if (params.minGapPct !== undefined) qs.set('min_gap_pct', String(params.minGapPct))
  if (params.minVolumeRatio !== undefined) qs.set('min_volume_ratio', String(params.minVolumeRatio))
  if (params.sector) qs.set('sector', params.sector)
  const { data, response } = await apiClient.getWithResponse<UniverseTickerOut[]>(
    `/v1/discover/universe?${qs.toString()}`,
  )
  const total = Number(response.headers.get('X-Total-Count') ?? data.length)
  return { items: data, total }
}

export function getSectorHeatmap() {
  return apiClient.get<SectorHeatmapOut>('/v1/discover/universe/sectors')
}

export function addManualTicker(ticker: string, note?: string) {
  return apiClient.post<TrackedTickerOut>('/v1/discover/universe', { ticker, note: note || undefined })
}

export function removeManualTicker(ticker: string) {
  return apiClient.delete<void>(`/v1/discover/universe/${encodeURIComponent(ticker)}`)
}

export function archiveTicker(ticker: string) {
  return apiClient.post<TrackedTickerOut>(
    `/v1/discover/universe/${encodeURIComponent(ticker)}/archive`,
  )
}

export function unarchiveTicker(ticker: string) {
  return apiClient.post<TrackedTickerOut>(
    `/v1/discover/universe/${encodeURIComponent(ticker)}/unarchive`,
  )
}

export function hardDeleteTicker(ticker: string) {
  return apiClient.delete<void>(`/v1/discover/universe/${encodeURIComponent(ticker)}/hard`)
}

export function getTrending(limit = 20) {
  return apiClient.get<TrendingSocialOut[]>(`/v1/discover/trending?limit=${limit}`)
}

export function getTwitterBestStocks(limit = 20) {
  return apiClient.get<TwitterBestStocksOut>(`/v1/discover/twitter-best-stocks?limit=${limit}`)
}

export function refreshTwitterBestStocks() {
  return apiClient.post<TwitterBestStocksRefreshOut>('/v1/discover/twitter-best-stocks/refresh')
}

export function searchUniverse(q: string, limit = 8) {
  const qs = new URLSearchParams({ q, limit: String(limit) })
  return apiClient.get<TickerSearchResult[]>(`/v1/discover/universe/search?${qs.toString()}`)
}
