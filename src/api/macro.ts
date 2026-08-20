import { apiClient } from '@/lib/api-client'
import type {
  MacroBucketGranularity,
  MacroNewsItemOut,
  MacroSectorImpactDateOut,
  MacroSectorImpactOut,
  MacroSignalHistoryBucketOut,
  MacroSignalOut,
} from '@/types/api'

export interface MacroNewsParams {
  category?: string
  hours?: number
}

export function getMacroSignal(hours = 24) {
  return apiClient.get<MacroSignalOut>(`/v1/macro/signal?hours=${hours}`)
}

export function getMacroSignalHistory(bucket: MacroBucketGranularity = 'day', periods = 14) {
  return apiClient.get<MacroSignalHistoryBucketOut[]>(
    `/v1/macro/signal/history?bucket=${bucket}&periods=${periods}`,
  )
}

export function getMacroNews(params: MacroNewsParams = {}) {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  query.set('hours', String(params.hours ?? 24))
  return apiClient.get<MacroNewsItemOut[]>(`/v1/macro/news?${query.toString()}`)
}

export function getMacroSectorImpact(date?: string) {
  const query = date ? `?date=${date}` : ''
  return apiClient.get<MacroSectorImpactOut>(`/v1/macro/sector-impact${query}`)
}

export function refreshMacroSectorImpact() {
  return apiClient.post<MacroSectorImpactOut>('/v1/macro/sector-impact/refresh')
}

export function getMacroSectorImpactDates(limit = 30) {
  return apiClient.get<MacroSectorImpactDateOut[]>(`/v1/macro/sector-impact/dates?limit=${limit}`)
}
