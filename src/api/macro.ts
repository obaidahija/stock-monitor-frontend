import { apiClient } from '@/lib/api-client'
import type {
  MacroExposureOut,
  MacroItemExplanationOut,
  MacroMovingOut,
  MacroNewsItemOut,
  SectorRotationOut,
} from '@/types/api'

export interface MacroNewsParams {
  hours?: number
  /** Hide items the trained reader rated low or no relevance. */
  relevantOnly?: boolean
}

export function getMacroMoving(hours = 24) {
  return apiClient.get<MacroMovingOut>(`/v1/macro/moving?hours=${hours}`)
}

export function getMacroNews(params: MacroNewsParams = {}) {
  const query = new URLSearchParams()
  query.set('hours', String(params.hours ?? 24))
  if (params.relevantOnly) query.set('relevant_only', 'true')
  return apiClient.get<MacroNewsItemOut[]>(`/v1/macro/news?${query.toString()}`)
}

export function getMacroItemExplanation(itemId: number) {
  return apiClient.get<MacroItemExplanationOut>(`/v1/macro/news/${itemId}/explanation`)
}

/** Who measurably reacts when a market driver (oil, yield_10y, dollar, ...) moves. */
export function getMacroExposures(driver: string, direction: 'up' | 'down') {
  return apiClient.get<MacroExposureOut>(`/v1/macro/exposures?driver=${driver}&direction=${direction}`)
}

export function getSectorRotation(window: 5 | 20 = 5) {
  return apiClient.get<SectorRotationOut>(`/v1/macro/sector-rotation?window=${window}`)
}
