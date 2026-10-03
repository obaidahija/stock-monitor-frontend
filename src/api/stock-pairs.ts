import { apiClient } from '@/lib/api-client'
import type { StockPairsOut } from '@/types/api'

/**
 * The spelling the server saves a report under: uppercase, with a one-letter share
 * class after a dot (BRK-B and BRK B become BRK.B), matching its normalize_ticker.
 */
export function pairTicker(ticker: string) {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]+)[- ]([A-Z])$/, '$1.$2')
}

function pairsPath(ticker: string) {
  return `/v1/stocks/${encodeURIComponent(pairTicker(ticker))}/pairs/research`
}

/** Reads the saved pair report; never starts a search. */
export function getStockPairs(ticker: string) {
  return apiClient.get<StockPairsOut | null>(pairsPath(ticker))
}

/**
 * Returns the saved report, or runs the first search when there is none.
 * `forceRefresh` repeats Google's research and replaces the report only on success.
 */
export function refreshStockPairs(ticker: string, forceRefresh = false) {
  return apiClient.post<StockPairsOut>(
    `${pairsPath(ticker)}${forceRefresh ? '?force_refresh=true' : ''}`,
  )
}
