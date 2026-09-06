import { apiClient } from '@/lib/api-client'
import type { GoogleFinanceMarketPicksOut, GoogleFinanceMarketPicksRefreshOut } from '@/types/api'

export function getGoogleFinanceMarketPicks() {
  return apiClient.get<GoogleFinanceMarketPicksOut>('/v1/discover/google-finance-market-picks')
}

export function refreshGoogleFinanceMarketPicks() {
  return apiClient.post<GoogleFinanceMarketPicksRefreshOut>(
    '/v1/discover/google-finance-market-picks/refresh',
  )
}
