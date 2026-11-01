import { apiClient } from '@/lib/api-client'
import type { FinancialHistoryOut, FinancialPeriod, FinancialRefreshResult } from '@/types/sec-fundamentals'

const path = (ticker: string) => `/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}/fundamentals`

export function getFinancialHistory(ticker: string, period: FinancialPeriod = 'quarterly', limit = 8, signal?: AbortSignal) {
  return apiClient.get<FinancialHistoryOut>(`${path(ticker)}?period=${period}&limit=${limit}`, signal)
}

export function refreshFinancialHistory(ticker: string) {
  return apiClient.post<FinancialRefreshResult>(`${path(ticker)}/refresh`)
}

export function getFinancialRefresh(ticker: string, requestId: string, signal?: AbortSignal) {
  return apiClient.get<FinancialRefreshResult>(`${path(ticker)}/refresh/${encodeURIComponent(requestId)}`, signal)
}
