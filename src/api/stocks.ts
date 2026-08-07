import { apiClient } from '@/lib/api-client'
import type {
  AnalysisOut,
  CatalystOut,
  EarningsSummary,
  FilingOut,
  NewsClusterDetailOut,
  NewsClusterOut,
  SentimentBucketGranularity,
  SentimentHistoryOut,
} from '@/types/api'

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

export function getNews(ticker: string, hours = 24) {
  return apiClient.get<NewsClusterOut[]>(
    `/v1/stocks/${encodeURIComponent(ticker)}/news?hours=${hours}`,
  )
}

export function getNewsClusterDetail(ticker: string, clusterId: number) {
  return apiClient.get<NewsClusterDetailOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/news/${clusterId}`,
  )
}

export function getCatalysts(ticker: string) {
  return apiClient.get<CatalystOut[]>(`/v1/stocks/${encodeURIComponent(ticker)}/catalysts`)
}

export function getAnalysis(ticker: string) {
  return apiClient.get<AnalysisOut>(`/v1/stocks/${encodeURIComponent(ticker)}/analysis`)
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
