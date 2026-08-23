import { apiClient } from '@/lib/api-client'
import type { TrendingSectorOut, TrendingSummaryOut, TrendingTickerOut } from '@/types/api'

export type TrendingWindow = 'today' | 'general'

export function getTrendingSummary(limit = 10) {
  return apiClient.get<TrendingSummaryOut>(`/v1/trending/summary?limit=${limit}`)
}

export interface TrendingLeaderboardParams {
  window?: TrendingWindow
  limit?: number
  offset?: number
  sector?: string
}

export interface TrendingLeaderboardPage {
  items: TrendingTickerOut[]
  total: number
}

export async function getTrendingLeaderboard(
  params: TrendingLeaderboardParams = {},
): Promise<TrendingLeaderboardPage> {
  const qs = new URLSearchParams()
  if (params.window) qs.set('window', params.window)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  if (params.sector) qs.set('sector', params.sector)
  const { data, response } = await apiClient.getWithResponse<TrendingTickerOut[]>(
    `/v1/trending/leaderboard?${qs.toString()}`,
  )
  const total = Number(response.headers.get('X-Total-Count') ?? data.length)
  return { items: data, total }
}

export function getTrendingSectors() {
  return apiClient.get<TrendingSectorOut[]>('/v1/trending/sectors')
}
