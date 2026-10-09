import { apiClient } from '@/lib/api-client'
import type {
  AiResearchOut,
  AnalysisOut,
  CatalystOut,
  ChartPatternOut,
  GoogleFinanceCompetitorsOut,
  EarningsPlaybookOut,
  EarningsReactionOut,
  EarningsRefreshResult,
  EarningsSummary,
  EventWindowOut,
  FilingOut,
  GoogleFinanceChatTurnIn,
  GoogleFinanceResearchOut,
  InsiderOut,
  NewsClusterDetailOut,
  NewsClusterOut,
  NewsItemExtractOut,
  NewsRefreshResult,
  PriceTargetChangeOut,
  QuoteOut,
  EtfDescriptionOut,
  RelatedEtfsOut,
  ScoreHistoryPointOut,
  SentimentBucketGranularity,
  SentimentHistoryOut,
  TrackedTickerOut,
  UniverseScoreRefreshResult,
} from '@/types/api'

export interface AnalysisExtras {
  includeChartPattern?: boolean
  /** Adds the selected 1-7 session research window; omitted keeps the legacy response. */
  horizonSessions?: number
}

export function getRelatedEtfs(ticker: string) {
  return apiClient.get<RelatedEtfsOut>(`/v1/stocks/${encodeURIComponent(ticker)}/related-etfs`)
}

export function getRelatedEtfDescription(ticker: string, etf: string) {
  return apiClient.get<EtfDescriptionOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/related-etfs/${encodeURIComponent(etf)}/description`,
  )
}

export function refreshRelatedEtfQuotes(ticker: string, tickers: string[]) {
  return apiClient.post<QuoteOut[]>(
    `/v1/stocks/${encodeURIComponent(ticker)}/related-etfs/quotes/refresh`,
    { tickers },
  )
}

export function getFilings(ticker: string, opts?: { form?: string; days?: number }) {
  const params = new URLSearchParams()
  if (opts?.form) params.set('form', opts.form)
  if (opts?.days) params.set('days', String(opts.days))
  const qs = params.toString()
  return apiClient.get<FilingOut[]>(
    `/v1/stocks/${encodeURIComponent(ticker)}/filings${qs ? `?${qs}` : ''}`,
  )
}

export function getEarnings(ticker: string) {
  return apiClient.get<EarningsSummary>(`/v1/stocks/${encodeURIComponent(ticker)}/earnings`)
}

export function getEarningsReaction(
  ticker: string,
  opts?: { beforeDays?: number; afterDays?: number },
) {
  const params = new URLSearchParams()
  if (opts?.beforeDays) params.set('before_days', String(opts.beforeDays))
  if (opts?.afterDays) params.set('after_days', String(opts.afterDays))
  const qs = params.toString()
  return apiClient.get<EarningsReactionOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/earnings-reaction${qs ? `?${qs}` : ''}`,
  )
}

export function getEarningsPlaybook(ticker: string) {
  return apiClient.get<EarningsPlaybookOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/earnings-playbook`,
  )
}

export function refreshEarnings(ticker: string) {
  return apiClient.post<EarningsRefreshResult>(
    `/v1/stocks/${encodeURIComponent(ticker)}/earnings/refresh`,
  )
}

export function getQuote(ticker: string) {
  return apiClient.get<QuoteOut>(`/v1/stocks/${encodeURIComponent(ticker)}/quote`)
}

export function refreshQuote(ticker: string) {
  return apiClient.post<QuoteOut>(`/v1/stocks/${encodeURIComponent(ticker)}/quote/refresh`)
}

export function getUniverseScore(ticker: string) {
  return apiClient.get<TrackedTickerOut | null>(
    `/v1/stocks/${encodeURIComponent(ticker)}/universe-score`,
  )
}

export function refreshUniverseScore(ticker: string) {
  return apiClient.post<UniverseScoreRefreshResult>(
    `/v1/stocks/${encodeURIComponent(ticker)}/universe-score/refresh`,
  )
}

export function getNews(ticker: string, hours = 24) {
  return apiClient.get<NewsClusterOut[]>(
    `/v1/stocks/${encodeURIComponent(ticker)}/news?hours=${hours}`,
  )
}

export function refreshNews(ticker: string) {
  return apiClient.post<NewsRefreshResult>(
    `/v1/stocks/${encodeURIComponent(ticker)}/news/refresh`,
  )
}

export function getNewsClusterDetail(ticker: string, clusterId: number) {
  return apiClient.get<NewsClusterDetailOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/news/${clusterId}`,
  )
}

export function extractNewsItem(ticker: string, itemId: number) {
  return apiClient.post<NewsItemExtractOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/news/${itemId}/extract`,
  )
}

export function getCatalysts(ticker: string) {
  return apiClient.get<CatalystOut[]>(`/v1/stocks/${encodeURIComponent(ticker)}/catalysts`)
}

export function getAnalysis(ticker: string, extras: AnalysisExtras = {}) {
  const params = new URLSearchParams()
  if (extras.includeChartPattern) params.set('include_chart_pattern', 'true')
  if (extras.horizonSessions !== undefined) {
    params.set('horizon_sessions', String(extras.horizonSessions))
  }
  const qs = params.toString()
  return apiClient.get<AnalysisOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/analysis${qs ? `?${qs}` : ''}`,
  )
}

export function getEventWindow(ticker: string, horizonSessions: number) {
  return apiClient.get<EventWindowOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/event-window?horizon_sessions=${horizonSessions}`,
  )
}

export function getChartPattern(ticker: string) {
  return apiClient.get<ChartPatternOut>(`/v1/stocks/${encodeURIComponent(ticker)}/chart-pattern`)
}

export function getAnalystPriceTargetHistory(ticker: string, limit = 20) {
  return apiClient.get<PriceTargetChangeOut[]>(
    `/v1/stocks/${encodeURIComponent(ticker)}/analyst-price-target-history?limit=${limit}`,
  )
}

export function getAiResearch(ticker: string) {
  return apiClient.get<AiResearchOut>(`/v1/stocks/${encodeURIComponent(ticker)}/ai-research`)
}

export function refreshAiResearch(ticker: string) {
  return apiClient.post<AiResearchOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/ai-research/refresh`,
  )
}

export function askGoogleFinanceResearch(
  ticker: string,
  question: string,
  history: GoogleFinanceChatTurnIn[] = [],
) {
  return apiClient.post<GoogleFinanceResearchOut>(
    `/v1/stocks/${ticker.toUpperCase()}/google-finance-research`,
    { question, history },
  )
}

export function getCompetitors(ticker: string) {
  return apiClient.get<GoogleFinanceCompetitorsOut | null>(
    `/v1/stocks/${encodeURIComponent(ticker)}/competitors/research`,
  )
}

export function refreshCompetitors(ticker: string, forceRefresh = false) {
  return apiClient.post<GoogleFinanceCompetitorsOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/competitors/research${forceRefresh ? '?force_refresh=true' : ''}`,
  )
}

export function getSentimentHistory(
  ticker: string,
  bucket: SentimentBucketGranularity,
  periods: number,
) {
  return apiClient.get<SentimentHistoryOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/sentiment-history?bucket=${bucket}&periods=${periods}`,
  )
}

export function getScoreHistory(ticker: string, days = 90) {
  return apiClient.get<ScoreHistoryPointOut[]>(
    `/v1/stocks/${ticker.toUpperCase()}/score-history?days=${days}`,
  )
}

export function getInsider(ticker: string, days = 90) {
  return apiClient.get<InsiderOut>(
    `/v1/stocks/${ticker.toUpperCase()}/insider?days=${days}`,
  )
}
