import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '@/api/macro'
import type { MacroBucketGranularity } from '@/types/api'

export const macroKeys = {
  signal: (hours: number) => ['macro', 'signal', hours] as const,
  signalHistory: (bucket: MacroBucketGranularity, periods: number) =>
    ['macro', 'signal-history', bucket, periods] as const,
  news: (params: api.MacroNewsParams) => ['macro', 'news', params] as const,
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

// Sector-impact resolves each candidate item through a local LLM call
// (app/services/macro_sector_impact_service.py) -- a 20-40s on-demand read,
// not something to poll for. A mutation matches the button-triggered
// pattern already used for other expensive on-demand reads (e.g.
// useRefreshAiResearch/ForecastCard's onGenerate), not a query.
export function useMacroSectorImpact() {
  return useMutation({
    mutationFn: (hours: number) => api.getMacroSectorImpact(hours),
  })
}
