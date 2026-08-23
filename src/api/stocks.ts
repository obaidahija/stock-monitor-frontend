import { apiClient } from '@/lib/api-client'
import type {
  AiResearchOut,
  AnalysisOut,
  CatalystOut,
  ChartPatternOut,
  EarningsRefreshResult,
  EarningsSummary,
  FilingOut,
  ForecastOut,
  NewsClusterDetailOut,
  NewsClusterOut,
  NewsItemExtractOut,
  NewsRefreshResult,
  SentimentBucketGranularity,
  SentimentHistoryOut,
  TrackedTickerOut,
  UniverseScoreRefreshResult,
} from '@/types/api'

export interface AnalysisExtras {
  includeChartPattern?: boolean
  includeForecast?: boolean
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

export function refreshEarnings(ticker: string) {
  return apiClient.post<EarningsRefreshResult>(
    `/v1/stocks/${encodeURIComponent(ticker)}/earnings/refresh`,
  )
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
  if (extras.includeForecast) params.set('include_forecast', 'true')
  const qs = params.toString()
  return apiClient.get<AnalysisOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/analysis${qs ? `?${qs}` : ''}`,
  )
}

export function getChartPattern(ticker: string) {
  return apiClient.get<ChartPatternOut>(`/v1/stocks/${encodeURIComponent(ticker)}/chart-pattern`)
}

export function getForecast(ticker: string) {
  return apiClient.get<ForecastOut>(`/v1/stocks/${encodeURIComponent(ticker)}/forecast`)
}

export function getAiResearch(ticker: string) {
  return apiClient.get<AiResearchOut>(`/v1/stocks/${encodeURIComponent(ticker)}/ai-research`)
}

export function refreshAiResearch(ticker: string) {
  return apiClient.post<AiResearchOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/ai-research/refresh`,
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
