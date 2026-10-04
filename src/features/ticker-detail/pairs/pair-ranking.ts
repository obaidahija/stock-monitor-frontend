import type { StockPairEvidenceStatus, StockPairItemOut } from '@/types/api'
import type { PairWindow } from './pair-metrics'

// Enough aligned daily returns for the window's correlation to be compared. The
// strength badge separately needs both windows and 20 up days of the selected stock.
const MIN_RANKED_RETURNS: Record<PairWindow, number> = { three_month: 40, six_month: 100 }
const UNMEASURED: ReadonlySet<StockPairEvidenceStatus> = new Set([
  'invalid_security',
  'price_unavailable',
  'price_stale',
])

function rankedValue(item: StockPairItemOut, window: PairWindow): number | null {
  if (UNMEASURED.has(item.evidence_status)) return null
  const measured = item[window]
  if (!measured || measured.sample_size < MIN_RANKED_RETURNS[window]) return null
  const value = measured.correlation
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Google's suggestions ordered by the selected window's signed correlation, highest
 * first, at full precision -- never by absolute value, badge or rounded display.
 * Exact ties keep Google's order, and candidates that cannot be ranked follow in
 * Google's order. Returns a new array: the cached report is never reordered.
 */
export function rankPairItems(
  items: readonly StockPairItemOut[],
  window: PairWindow,
): StockPairItemOut[] {
  const ranked: { item: StockPairItemOut; value: number; index: number }[] = []
  const unranked: StockPairItemOut[] = []
  items.forEach((item, index) => {
    const value = rankedValue(item, window)
    if (value === null) unranked.push(item)
    else ranked.push({ item, value, index })
  })
  ranked.sort((a, b) => b.value - a.value || a.index - b.index)
  return [...ranked.map((entry) => entry.item), ...unranked]
}
