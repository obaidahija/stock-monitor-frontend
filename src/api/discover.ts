import { apiClient } from '@/lib/api-client'
import type {
  FilingOut,
  GapperOut,
  TrackedTickerOut,
  TrendingSocialOut,
  UnusualVolumeOut,
} from '@/types/api'

export function getNotableFilings() {
  return apiClient.get<FilingOut[]>('/v1/discover/filings')
}

export interface UniverseParams {
  sort?: 'score' | 'ticker' | 'added_at'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
  manualOnly?: boolean
}

export function getUniverse(params: UniverseParams = {}) {
  const qs = new URLSearchParams()
  if (params.sort) qs.set('sort', params.sort)
  if (params.order) qs.set('order', params.order)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  if (params.manualOnly !== undefined) qs.set('manual_only', String(params.manualOnly))
  return apiClient.get<TrackedTickerOut[]>(`/v1/discover/universe?${qs.toString()}`)
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
