import { apiClient } from '@/lib/api-client'
import type {
  EarningsResult,
  FilingOut,
  InsiderSummaryOut,
  SectorHeatmapOut,
  TickerSearchResult,
  TrackedTickerOut,
  TwitterBestStocksOut,
  TwitterBestStocksRefreshOut,
  UniverseTickerOut,
} from '@/types/api'

export function getNotableFilings() {
  return apiClient.get<FilingOut[]>('/v1/discover/filings')
}

export interface UniverseParams {
  sort?:
    | 'score'
    | 'ticker'
    | 'next_earnings_date'
    | 'change_pct'
    | 'volume_ratio'
    | 'pe_ratio'
    | 'score_change'
    | 'short_percent_of_float'
    | 'sector_score_percentile'
    | 'industry_score_percentile'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
  earningsResult?: EarningsResult
  minGapPct?: number
  minVolumeRatio?: number
  minShortPct?: number
  maxFloatShares?: number
  hasInsiderBuy?: boolean
  patternLabel?: string
  sector?: string
  q?: string
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
  if (params.earningsResult) qs.set('earnings_result', params.earningsResult)
  if (params.minGapPct !== undefined) qs.set('min_gap_pct', String(params.minGapPct))
  if (params.minVolumeRatio !== undefined) qs.set('min_volume_ratio', String(params.minVolumeRatio))
  if (params.minShortPct !== undefined) qs.set('min_short_pct', String(params.minShortPct))
  if (params.maxFloatShares !== undefined) {
    qs.set('max_float_shares', String(params.maxFloatShares))
  }
  if (params.hasInsiderBuy !== undefined) {
    qs.set('has_insider_buy', String(params.hasInsiderBuy))
  }
  if (params.patternLabel) qs.set('pattern_label', params.patternLabel)
  if (params.sector) qs.set('sector', params.sector)
  if (params.q) qs.set('q', params.q)
  const { data, response } = await apiClient.getWithResponse<UniverseTickerOut[]>(
    `/v1/discover/universe?${qs.toString()}`,
  )
  const total = Number(response.headers.get('X-Total-Count') ?? data.length)
  return { items: data, total }
}

export function getSectorHeatmap() {
  return apiClient.get<SectorHeatmapOut>('/v1/discover/universe/sectors')
}

export function getInsiderBuying(days = 30, minValue?: number) {
  const qs = new URLSearchParams({ days: String(days) })
  if (minValue !== undefined) qs.set('min_value', String(minValue))
  return apiClient.get<InsiderSummaryOut[]>(
    `/v1/discover/insider-buying?${qs.toString()}`,
  )
}

export function addCustomTicker(ticker: string, note?: string) {
  return apiClient.post<TrackedTickerOut>('/v1/discover/universe', { ticker, note: note || undefined })
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
