import { apiClient } from '@/lib/api-client'
import type { PairBacktestOut } from '@/types/pair-backtest'
import { pairTicker } from './stock-pairs'

/** The selected stock first, the candidate second: B/A is a different backtest. */
function backtestPath(ticker: string, candidateTicker: string) {
  const target = encodeURIComponent(pairTicker(ticker))
  const candidate = encodeURIComponent(pairTicker(candidateTicker))
  return `/v1/stocks/${target}/pairs/${candidate}/backtest`
}

/** Reads the saved backtest of one ordered pair; never calculates. */
export function getPairBacktest(ticker: string, candidateTicker: string) {
  return apiClient.get<PairBacktestOut | null>(backtestPath(ticker, candidateTicker))
}

/**
 * Returns the saved backtest, or runs the first one when there is none.
 * `forceRefresh` replays with a new data cutoff and replaces the saved backtest only
 * when the run completes.
 */
export function runPairBacktest(ticker: string, candidateTicker: string, forceRefresh = false) {
  return apiClient.post<PairBacktestOut>(
    `${backtestPath(ticker, candidateTicker)}${forceRefresh ? '?force_refresh=true' : ''}`,
  )
}
