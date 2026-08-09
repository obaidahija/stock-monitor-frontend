import { apiClient } from '@/lib/api-client'
import type {
  EarningsResult,
  FilingOut,
  GapperOut,
  TrackedTickerOut,
  TrendingSocialOut,
  UniverseTickerOut,
  UnusualVolumeOut,
} from '@/types/api'

export function getNotableFilings() {
  return apiClient.get<FilingOut[]>('/v1/discover/filings')
}

export interface UniverseParams {
  sort?: 'score' | 'ticker' | 'added_at' | 'next_earnings_date'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
  manualOnly?: boolean
  earningsResult?: EarningsResult
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
  if (params.earningsResult) qs.set('earnings_result', params.earningsResult)
  const { data, response } = await apiClient.getWithResponse<UniverseTickerOut[]>(
    `/v1/discover/universe?${qs.toString()}`,
  )
  const total = Number(response.headers.get('X-Total-Count') ?? data.length)
  return { items: data, total }
}

export function addManualTicker(ticker: string, note?: string) {
  return apiClient.post<TrackedTickerOut>('/v1/discover/universe', { ticker, note: note || undefined })
}

export function removeManualTicker(ticker: string) {
  return apiClient.delete<void>(`/v1/discover/universe/${encodeURIComponent(ticker)}`)
}

export function getTrending(limit = 20) {
  return apiClient.get<TrendingSocialOut[]>(`/v1/discover/trending?limit=${limit}`)
}

export function getGappers(minGapPct = 3) {
  return apiClient.get<GapperOut[]>(`/v1/discover/gappers?min_gap_pct=${minGapPct}`)
}

export function getUnusualVolume(minRatio = 2) {
  return apiClient.get<UnusualVolumeOut[]>(`/v1/discover/unusual-volume?min_ratio=${minRatio}`)
}
