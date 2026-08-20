import { apiClient } from '@/lib/api-client'
import type {
  MacroBucketGranularity,
  MacroNewsItemOut,
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
