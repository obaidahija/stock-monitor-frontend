import { apiClient } from '@/lib/api-client'
import type {
  AnalyzeIn,
  AnalyzeOut,
  ExpectedFilingOut,
  FilingEpisodeOut,
  FilingIntelFilingOut,
  PriceSeriesOut,
  QuoteOut,
} from '@/types/filing-intel'

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function getUpcomingFilings(params: { days?: number; form?: string; ticker?: string; include_filed?: boolean }) {
  return apiClient.get<ExpectedFilingOut[]>(`/v1/filing-intel/upcoming${query(params)}`)
}

export function getRecentFilings(params: {
  hours?: number
  ticker?: string
  event_type?: string
  topic?: string
  form?: string
  coverage?: string
  kind?: string
  signal?: string
  before?: string
  limit?: number
}) {
  return apiClient.get<FilingIntelFilingOut[]>(`/v1/filing-intel/recent${query(params)}`)
}

export function getFiling(accession: string) {
  return apiClient.get<FilingIntelFilingOut>(`/v1/filing-intel/filings/${encodeURIComponent(accession)}`)
}

export function getFilingEpisodes(ticker: string, days = 90) {
  return apiClient.get<FilingEpisodeOut[]>(`/v1/filing-intel/episodes${query({ ticker, days })}`)
}

export function analyzeFilings(body: AnalyzeIn) {
  return apiClient.post<AnalyzeOut>('/v1/filing-intel/analyze', body)
}

export function getCurrentPrices(tickers: string[]) {
  return apiClient.get<QuoteOut[]>(`/v1/filing-intel/prices${query({ tickers: tickers.join(',') })}`)
}

export function getFilingChart(accession: string, interval: 'auto' | '5m' | '1d' = 'auto') {
  return apiClient.get<PriceSeriesOut>(
    `/v1/filing-intel/filings/${encodeURIComponent(accession)}/chart${query({ interval })}`,
  )
}
