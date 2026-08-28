import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnalysisExtras } from '@/api/stocks'
import {
  extractNewsItem,
  getAiResearch,
  getAnalysis,
  getCatalysts,
  getCompetitors,
  getEarnings,
  getEarningsReaction,
  getFilings,
  getNews,
  getSentimentHistory,
  getUniverseScore,
  refreshAiResearch,
  refreshCompetitors,
  refreshEarnings,
  refreshNews,
  refreshUniverseScore,
} from '@/api/stocks'
import type { SentimentBucketGranularity } from '@/types/api'

export function useAnalysis(ticker: string, extras: AnalysisExtras = {}, enabled = true) {
  return useQuery({
    queryKey: ['analysis', ticker, extras.includeChartPattern ?? false],
    queryFn: () => getAnalysis(ticker, extras),
    enabled,
  })
}

export function useUniverseScore(ticker: string) {
  return useQuery({
    queryKey: ['universe-score', ticker],
    queryFn: () => getUniverseScore(ticker),
  })
}

export function useRefreshUniverseScore(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshUniverseScore(ticker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universe-score', ticker] })
      // The universe score is rescaled from the same analyze_ticker() composite
      // the factor breakdown below renders — refresh both so they can't drift apart.
      queryClient.invalidateQueries({ queryKey: ['analysis', ticker] })
    },
  })
}

export function useAutoRefreshUniverseScore(ticker: string) {
  const { mutate } = useRefreshUniverseScore(ticker)
  const lastRequestedTicker = useRef<string | null>(null)

  useEffect(() => {
    if (!ticker || lastRequestedTicker.current === ticker) return

    lastRequestedTicker.current = ticker
    mutate()
  }, [mutate, ticker])
}

export function useSentimentHistory(
  ticker: string,
  bucket: SentimentBucketGranularity,
  periods: number,
) {
  return useQuery({
    queryKey: ['sentiment-history', ticker, bucket, periods],
    queryFn: () => getSentimentHistory(ticker, bucket, periods),
  })
}

export function useEarnings(ticker: string) {
  return useQuery({ queryKey: ['earnings', ticker], queryFn: () => getEarnings(ticker) })
}

export function useEarningsReaction(ticker: string) {
  return useQuery({
    queryKey: ['earnings-reaction', ticker],
    queryFn: () => getEarningsReaction(ticker),
  })
}

export function useRefreshEarnings(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshEarnings(ticker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['earnings', ticker] })
      queryClient.invalidateQueries({ queryKey: ['earnings-reaction', ticker] })
    },
  })
}

export function useNews(ticker: string, hours: number) {
  return useQuery({ queryKey: ['news', ticker, hours], queryFn: () => getNews(ticker, hours) })
}

export function useRefreshNews(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshNews(ticker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news', ticker] })
      queryClient.invalidateQueries({ queryKey: ['universe-score', ticker] })
    },
  })
}

export function useExtractNewsItem(ticker: string, clusterId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => extractNewsItem(ticker, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-cluster-detail', ticker, clusterId] })
    },
  })
}

export function useFilings(ticker: string) {
  return useQuery({ queryKey: ['filings', ticker], queryFn: () => getFilings(ticker) })
}

export function useCatalysts(ticker: string) {
  return useQuery({ queryKey: ['catalysts', ticker], queryFn: () => getCatalysts(ticker) })
}

export function useAiResearch(ticker: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-research', ticker],
    queryFn: () => getAiResearch(ticker),
    enabled,
  })
}

export function useRefreshAiResearch(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshAiResearch(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-research', ticker] }),
  })
}

export function useCompetitors(ticker: string) {
  return useQuery({
    queryKey: ['competitors', ticker],
    // cacheOnly: true -- auto-fetch on tab mount must never silently trigger
    // the EDGAR+LLM pipeline; only the explicit Refresh action (POST
    // .../refresh, see useRefreshCompetitors) should ever compute a fresh result.
    queryFn: () => getCompetitors(ticker, { cacheOnly: true }),
  })
}

export function useRefreshCompetitors(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshCompetitors(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competitors', ticker] }),
  })
}
