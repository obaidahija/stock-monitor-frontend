import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getSectorHeatmap } from '@/api/discover'
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
  getNewsBrief,
  getQuote,
  getScoreHistory,
  getSentimentHistory,
  getUniverseScore,
  refreshAiResearch,
  refreshCompetitors,
  refreshEarnings,
  refreshNews,
  refreshNewsBrief,
  refreshQuote,
  refreshUniverseScore,
} from '@/api/stocks'
import type {
  AiResearchOut,
  GoogleFinanceChatTurnIn,
  QuoteOut,
  SentimentBucketGranularity,
} from '@/types/api'
import { isOlderPairReport } from './pairs/pair-report-version'
import {
  assertQuoteIdentity,
  isQuoteRefreshPending,
  issueQuoteRequest,
  normalizeQuoteTicker,
  publishQuote,
  quoteQueryKey,
  reconcileQuote,
  shareQuote,
  trackQuoteRefresh,
} from './quote-version'

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
  const queryClient = useQueryClient()
  const symbol = normalizeQuoteTicker(ticker)
  return useQuery({
    // The initial load and every subsequent update while the page stays
    // open both go through useAutoRefreshQuote's live yfinance refresh
    // below -- this read only seeds the cache and never downgrades it.
    queryKey: quoteQueryKey(symbol),
    queryFn: async ({ signal }) => {
      const sequence = issueQuoteRequest(queryClient, symbol)
      return reconcileQuote(queryClient, symbol, await getQuote(symbol, signal), sequence)
    },
    structuralSharing: (current, incoming) => shareQuote(
      queryClient, symbol, current as QuoteOut | undefined, incoming as QuoteOut,
    ),
  })
}

/** Fetches a live quote and publishes it under the ticker it was requested for. */
function refreshQuoteInto(queryClient: QueryClient, ticker: string): Promise<QuoteOut> {
  const symbol = normalizeQuoteTicker(ticker)
  return trackQuoteRefresh(queryClient, symbol, async () => {
    const sequence = issueQuoteRequest(queryClient, symbol)
    const incoming = await refreshQuote(symbol)
    assertQuoteIdentity(symbol, incoming)
    // An outstanding read is older than this response: cancel it so its late
    // completion cannot overwrite what is published here.
    await queryClient.cancelQueries({ queryKey: quoteQueryKey(symbol), exact: true })
    return publishQuote(queryClient, symbol, incoming, sequence)
  })
}

export function useRefreshQuote(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // The response is published under the ticker this call requested, never
    // under whichever ticker is rendered when it lands.
    mutationFn: (requested: string | void) => refreshQuoteInto(queryClient, requested ?? ticker),
  })
}

// Polls the live yfinance-backed refresh endpoint every 10s while the ticker
// page is open, matching watchlist_price_sync's own cadence, instead of
// waiting on the much slower scheduled price_sync job.
export function useAutoRefreshQuote(ticker: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticker) return

    const symbol = normalizeQuoteTicker(ticker)
    const refresh = () => {
      // One automatic refresh per ticker at a time: a slow response must not
      // queue another request behind it on every interval.
      if (isQuoteRefreshPending(queryClient, symbol)) return
      refreshQuoteInto(queryClient, symbol).catch(() => undefined)
    }
    refresh()
    const interval = setInterval(refresh, QUOTE_LIVE_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [queryClient, ticker])
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
      queryClient.invalidateQueries({ queryKey: ['catalysts', ticker] })
      queryClient.invalidateQueries({ queryKey: ['discover', 'universe'] })
      queryClient.invalidateQueries({ queryKey: ['analysis', ticker] })
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
  return useQuery({
    queryKey: ['filings', ticker], queryFn: () => getFilings(ticker),
    refetchInterval: (query) => query.state.data?.some((filing) =>
      filing.analysis?.status === 'processing'
    ) ? 30_000 : false,
  })
}

export function useCatalysts(ticker: string) {
  return useQuery({ queryKey: ['catalysts', ticker], queryFn: () => getCatalysts(ticker) })
}

function aiResearchKey(ticker: string) {
  return ['ai-research', ticker.trim().toUpperCase()] as const
}

function assertAiReportIdentity(ticker: string, report: AiResearchOut) {
  if ((report.ticker ?? '').trim().toUpperCase() !== ticker) {
    throw new Error(`An AI research report for ${report.ticker} answered a ${ticker} request`)
  }
}

/**
 * The report a ticker's cache keeps: a failed attempt never displaces a
 * successful report, and otherwise the later generated_at wins.
 */
function preferredAiReport(incoming: AiResearchOut, current: AiResearchOut | undefined) {
  if (!current) return incoming
  if (incoming.source.ok !== current.source.ok) return incoming.source.ok ? incoming : current
  return isOlderPairReport(incoming, current) ? current : incoming
}

export function useAiResearch(ticker: string, enabled: boolean) {
  const queryClient = useQueryClient()
  const key = aiResearchKey(ticker)
  return useQuery({
    queryKey: key,
    // This GET can start paid generation. Keep it alive after its last
    // observer leaves so returning can follow the same request and result.
    // Explicit refresh cancellation still prevents a late result publishing.
    queryFn: async () => {
      const report = await getAiResearch(key[1])
      assertAiReportIdentity(key[1], report)
      return preferredAiReport(report, queryClient.getQueryData<AiResearchOut>(key))
    },
    enabled,
    // Generating may be paid and is always user initiated: a report is never
    // requested again by focus or reconnect, and a failure waits for a retry.
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useRefreshAiResearch(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const requested = aiResearchKey(ticker)[1]
      const report = await refreshAiResearch(requested)
      assertAiReportIdentity(requested, report)
      return report
    },
    onSuccess: async (report) => {
      // A failed refresh is reported beside the existing report, never in its place.
      if (!report.source.ok) return
      // Published under the response's own ticker; a stale read is cancelled
      // first so its late completion cannot overwrite this report.
      const key = aiResearchKey(report.ticker)
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      queryClient.setQueryData<AiResearchOut>(key, (current) => preferredAiReport(report, current))
    },
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

export function useNewsBrief(ticker: string) {
  return useQuery({
    queryKey: ['ticker-news-brief', ticker.toUpperCase()],
    // GET only reads the saved brief. Generating one requires an explicit POST.
    queryFn: () => getNewsBrief(ticker),
  })
}

export function useRefreshNewsBrief(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forceRefresh: boolean) => refreshNewsBrief(ticker, forceRefresh),
    onSuccess: async (result) => {
      if (result.source.ok && result.snapshot_id !== null) {
        await queryClient.cancelQueries({ queryKey: ['ticker-news-brief', result.ticker] })
        queryClient.setQueryData(['ticker-news-brief', result.ticker], result)
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

/** Shares the sector map's cached industry averages, refreshed while the detail page is open. */
export function useIndustryPerformance(sector: string | null, industry: string | null) {
  const query = useQuery({
    queryKey: ['discover', 'universe', 'sectors'],
    queryFn: getSectorHeatmap,
    enabled: Boolean(sector && industry),
    refetchInterval: 60_000,
  })
  return query.data?.items
    .find((item) => item.sector === sector?.trim())
    ?.industries?.find((item) => item.industry === industry?.trim()) ?? null
}
