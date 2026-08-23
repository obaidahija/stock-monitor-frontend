import type { EarningsResult } from '@/types/api'

export const EARNINGS_RESULT_BADGE_CLASSES: Record<EarningsResult, string> = {
  beat: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  miss: 'bg-red-500/15 text-red-600 dark:text-red-400',
  inline: 'bg-muted text-muted-foreground',
}

export const EARNINGS_RESULT_TEXT_CLASSES: Record<EarningsResult, string> = {
  beat: 'text-emerald-600 dark:text-emerald-400',
  miss: 'text-red-600 dark:text-red-400',
  inline: 'text-muted-foreground',
}

export const EARNINGS_RESULT_DOT_CLASSES: Record<EarningsResult, string> = {
  beat: 'bg-emerald-500',
  miss: 'bg-red-500',
  inline: 'bg-muted-foreground/50',
}

export const EARNINGS_RESULT_LABEL: Record<EarningsResult, string> = {
  beat: 'Beat',
  miss: 'Miss',
  inline: 'In-line',
}

// Actual within this % of estimate reads as "in-line" rather than a real
// beat/miss — mirrors the backend's own tolerance (app/services/
// tracked_ticker_service.py's EARNINGS_SURPRISE_TOLERANCE_PCT) so the
// universe table's server-computed badges and this tab's client-computed
// ones never disagree on the same quarter.
const SURPRISE_TOLERANCE_PCT = 1

export function classifyEarnings(
  actual: number | null,
  estimate: number | null,
): { result: EarningsResult | null; surprisePct: number | null } {
  if (actual === null || estimate === null || estimate === 0) {
    return { result: null, surprisePct: null }
  }
  const surprisePct = ((actual - estimate) / Math.abs(estimate)) * 100
  if (Math.abs(surprisePct) <= SURPRISE_TOLERANCE_PCT) return { result: 'inline', surprisePct }
  return { result: surprisePct > 0 ? 'beat' : 'miss', surprisePct }
}
