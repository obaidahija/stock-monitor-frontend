import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnalysisExtras } from '@/api/stocks'
import {
  askGoogleFinanceResearch,
  extractNewsItem,
  getAiResearch,
  getAnalysis,
  getAnalystPriceTargetHistory,
  getCatalysts,
  getCompetitors,
  getEarnings,
  getEarningsPlaybook,
  getEarningsReaction,
  getFilings,
  getInsider,
  getNews,
  getQuote,
  getScoreHistory,
  getSentimentHistory,
  getUniverseScore,
  refreshAiResearch,
  refreshCompetitors,
  refreshEarnings,
  refreshNews,
  refreshQuote,
  refreshUniverseScore,
} from '@/api/stocks'
import type { GoogleFinanceChatTurnIn, SentimentBucketGranularity } from '@/types/api'

export function useAnalysis(ticker: string, extras: AnalysisExtras = {}, enabled = true) {
  return useQuery({
    // The research window is part of the identity: each selection caches
    // separately, and choosing one never mutates a saved setup.
    queryKey: [
      'analysis',
      ticker,
      extras.includeChartPattern ?? false,
      extras.horizonSessions ?? null,
    ],
    queryFn: () => getAnalysis(ticker, extras),
    enabled,
  })
}

export function useAnalystPriceTargetHistory(ticker: string) {
  return useQuery({
    queryKey: ['analyst-price-target-history', ticker],
    queryFn: () => getAnalystPriceTargetHistory(ticker),
  })
}

const QUOTE_LIVE_REFRESH_INTERVAL_MS = 10_000

export function useQuote(ticker: string) {
  return useQuery({
    // The initial load and every subsequent update while the page stays
    // open both go through useAutoRefreshQuote's live yfinance refresh
    // below -- this query is cache-only (no queryFn refetch of its own).
    queryKey: ['quote', ticker],
    queryFn: () => getQuote(ticker),
  })
}

export function useRefreshQuote(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshQuote(ticker),
    onSuccess: (quote) => queryClient.setQueryData(['quote', ticker], quote),
  })
}

// Polls the live yfinance-backed refresh endpoint every 10s while the ticker
// page is open, matching watchlist_price_sync's own cadence, instead of
// waiting on the much slower scheduled price_sync job.
export function useAutoRefreshQuote(ticker: string) {
  const { mutate } = useRefreshQuote(ticker)
  const mutateRef = useRef(mutate)
  mutateRef.current = mutate

  useEffect(() => {
    if (!ticker) return

    mutateRef.current()
    const interval = setInterval(() => mutateRef.current(), QUOTE_LIVE_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [ticker])
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
      // analyze_ticker's force_refresh also records any brand-new analyst
      // action into analyst_price_target_events inline -- refetch the history
      // list too, or a just-recorded revision would be missing until the
      // next unrelated refetch.
      queryClient.invalidateQueries({ queryKey: ['analyst-price-target-history', ticker] })
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

export function useEarningsPlaybook(ticker: string) {
  return useQuery({
    queryKey: ['earnings-playbook', ticker],
    queryFn: () => getEarningsPlaybook(ticker),
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

export function useGoogleFinanceResearch(ticker: string) {
  return useMutation({
    mutationFn: (vars: { question: string; history: GoogleFinanceChatTurnIn[] }) =>
      askGoogleFinanceResearch(ticker, vars.question, vars.history),
  })
}

export function useCompetitors(ticker: string) {
  return useQuery({
    queryKey: ['google-finance-competitors', ticker.toUpperCase()],
    // GET only reads the saved response. The first search requires an explicit POST.
    queryFn: () => getCompetitors(ticker),
  })
}

export function useRefreshCompetitors(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forceRefresh: boolean) => refreshCompetitors(ticker, forceRefresh),
    onSuccess: async (result) => {
      if (result.source.ok && result.snapshot_id !== null) {
        await queryClient.cancelQueries({ queryKey: ['google-finance-competitors', result.ticker] })
        queryClient.setQueryData(['google-finance-competitors', result.ticker], result)
      }
    },
  })
}

export function useScoreHistory(ticker: string, days = 90) {
  return useQuery({
    queryKey: ['stocks', ticker, 'score-history', days],
    queryFn: () => getScoreHistory(ticker, days),
  })
}

export function useInsider(ticker: string, days = 90) {
  return useQuery({
    queryKey: ['stocks', ticker, 'insider', days],
    queryFn: () => getInsider(ticker, days),
  })
}
