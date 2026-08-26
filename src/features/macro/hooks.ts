import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/macro'
import { ApiError } from '@/lib/api-client'
import type { MacroBucketGranularity } from '@/types/api'

export const macroKeys = {
  signal: (hours: number) => ['macro', 'signal', hours] as const,
  signalHistory: (bucket: MacroBucketGranularity, periods: number) =>
    ['macro', 'signal-history', bucket, periods] as const,
  news: (params: api.MacroNewsParams) => ['macro', 'news', params] as const,
  sectorImpact: (date: string | undefined) => ['macro', 'sector-impact', date ?? 'today'] as const,
  sectorImpactDates: (limit: number) => ['macro', 'sector-impact-dates', limit] as const,
}

export function useMacroSignal(hours = 24) {
  return useQuery({
    queryKey: macroKeys.signal(hours),
    queryFn: () => api.getMacroSignal(hours),
    // macro_news_ingest/classify run on their own schedule (hourly/every 30
    // min) -- a light poll keeps the dashboard reasonably fresh without a
    // manual refresh button.
    refetchInterval: 60_000,
  })
}

export function useMacroSignalHistory(bucket: MacroBucketGranularity, periods: number) {
  return useQuery({
    queryKey: macroKeys.signalHistory(bucket, periods),
    queryFn: () => api.getMacroSignalHistory(bucket, periods),
    refetchInterval: 60_000,
  })
}

export function useMacroNews(params: api.MacroNewsParams) {
  return useQuery({
    queryKey: macroKeys.news(params),
    queryFn: () => api.getMacroNews(params),
    // Same eventual-consistency pattern as useRedditFeed's sentiment_pending
    // poll: items land unclassified from macro_news_ingest and pick up
    // categories/sentiment separately from macro_news_classify, so poll
    // faster while any visible item is still pending.
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.classification_pending) ? 15_000 : 60_000,
  })
}

// Sector-impact is now a persisted, date-keyed snapshot (one row per ET
// calendar date -- app/services/macro_sector_impact_service.py). Reading it
// is a cheap DB lookup, so this is a query again, not a mutation; a 404
// just means "not computed yet for this date," not a failure worth retrying.
export function useMacroSectorImpact(date?: string) {
  return useQuery({
    queryKey: macroKeys.sectorImpact(date),
    queryFn: () => api.getMacroSectorImpact(date),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false
      return failureCount < 2
    },
  })
}

// The actual recompute stays a mutation -- button-triggered, same pattern as
// useRefreshAiResearch. Always targets today only;
// resolves each *new* candidate item through a local LLM call (cached
// resolutions are reused), so it's ~20-40s the first time new items show up
// and near-instant once nothing's changed.
export function useRefreshMacroSectorImpact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.refreshMacroSectorImpact(),
    onSuccess: (data) => {
      queryClient.setQueryData(macroKeys.sectorImpact(undefined), data)
      queryClient.setQueryData(macroKeys.sectorImpact(data.impact_date), data)
      queryClient.invalidateQueries({ queryKey: ['macro', 'sector-impact-dates'] })
    },
  })
}

export function useMacroSectorImpactDates(limit = 30) {
  return useQuery({
    queryKey: macroKeys.sectorImpactDates(limit),
    queryFn: () => api.getMacroSectorImpactDates(limit),
  })
}
