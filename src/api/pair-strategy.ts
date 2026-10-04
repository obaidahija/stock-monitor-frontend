import { apiClient } from '@/lib/api-client'
import type { PairStrategyOut } from '@/types/pair-strategy'
import { pairTicker } from './stock-pairs'

/** The selected stock first, the candidate second: B/A is a different analysis. */
function strategyPath(ticker: string, candidateTicker: string) {
  const target = encodeURIComponent(pairTicker(ticker))
  const candidate = encodeURIComponent(pairTicker(candidateTicker))
  return `/v1/stocks/${target}/pairs/${candidate}/strategy`
}

/** Reads the saved analysis of one ordered pair; never calculates. */
export function getPairStrategy(ticker: string, candidateTicker: string) {
  return apiClient.get<PairStrategyOut | null>(strategyPath(ticker, candidateTicker))
}

/**
 * Returns the saved analysis, or runs the first one when there is none.
 * `forceRefresh` recalculates and replaces the saved analysis only when the run completes.
 */
export function analyzePairStrategy(ticker: string, candidateTicker: string, forceRefresh = false) {
  return apiClient.post<PairStrategyOut>(
    `${strategyPath(ticker, candidateTicker)}${forceRefresh ? '?force_refresh=true' : ''}`,
  )
}
