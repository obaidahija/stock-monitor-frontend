import { apiClient, apiFetch, ApiError } from '@/lib/api-client'
import type { EventStudy, FilingEstimate, HistoricalFacts } from '@/features/digest/event-study-types'

const base = '/v1/digest/event-study'

export function getEventStudy() {
  return apiClient.get<EventStudy>(base)
}

export function getHistoricalEventFacts(ticker?: string) {
  return apiClient.get<HistoricalFacts[]>(`${base}/facts${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''}`)
}

export function getFilingEstimate(ticker: string, filingUrl?: string) {
  const query = filingUrl ? `?filing_url=${encodeURIComponent(filingUrl)}` : ''
  return apiClient.get<FilingEstimate>(`${base}/ticker/${encodeURIComponent(ticker)}${query}`)
}

export function analyzeFiling(ticker: string, filingUrl?: string, force = false) {
  return apiClient.post<FilingEstimate>(`${base}/ticker/${encodeURIComponent(ticker)}/analyze`, {
    filing_url: filingUrl ?? null,
    force,
  })
}

export async function downloadEventStudy() {
  const response = await apiFetch(`${base}/download`)
  if (!response.ok) throw new ApiError(response.status, 'Unable to download the historical study')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'event-direction-study.zip'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function getEventStudyProgress() {
  return apiClient.get<{ status: string; stocks: number; completed?: number; total?: number; events?: number; outcomes?: number; updated_at?: string; published_study_id?: string }>(`${base}/retraining`)
}
