import { useQuery } from '@tanstack/react-query'
import * as api from '@/api/macro'
import { ApiError } from '@/lib/api-client'

export const macroKeys = {
  moving: (hours: number) => ['macro', 'moving', hours] as const,
  news: (params: api.MacroNewsParams) => ['macro', 'news', params] as const,
  sectorRotation: (window: number) => ['macro', 'sector-rotation', window] as const,
  explanation: (itemId: number | null) => ['macro', 'explanation', itemId] as const,
  exposures: (driver: string | null, direction: string) => ['macro', 'exposures', driver, direction] as const,
}

/** Measured exposures change weekly; 404 until the first refresh, which is not worth retrying. */
export function useMacroExposures(driver: string | null, direction: 'up' | 'down') {
  return useQuery({
    queryKey: macroKeys.exposures(driver, direction),
    queryFn: () => api.getMacroExposures(driver!, direction),
    enabled: driver !== null,
    staleTime: 3_600_000,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  })
}

/** Why the trained reader rated an item the way it did (~0.05 s, read on open). */
export function useMacroItemExplanation(itemId: number | null) {
  return useQuery({
    queryKey: macroKeys.explanation(itemId),
    queryFn: () => api.getMacroItemExplanation(itemId!),
    enabled: itemId !== null,
    staleTime: Infinity,
  })
}

/** Relevant macro events grouped by driver; macro_news_ingest runs hourly. */
export function useMacroMoving(hours = 24) {
  return useQuery({
    queryKey: macroKeys.moving(hours),
    queryFn: () => api.getMacroMoving(hours),
    refetchInterval: 60_000,
  })
}

export function useMacroNews(params: api.MacroNewsParams) {
  return useQuery({
    queryKey: macroKeys.news(params),
    queryFn: () => api.getMacroNews(params),
    // Items land unread from macro_news_ingest and pick up the reader's
    // relevance a moment later, so poll faster while any is still pending.
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.model_relevant == null) ? 15_000 : 60_000,
  })
}

export function useSectorRotation(window: 5 | 20 = 5) {
  return useQuery({
    queryKey: macroKeys.sectorRotation(window),
    queryFn: () => api.getSectorRotation(window),
    // trend_pct only changes once per trading day.
    refetchInterval: 300_000,
  })
}
