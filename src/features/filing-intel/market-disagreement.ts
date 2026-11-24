import type { FilingIntelFilingOut, QuoteOut } from '@/types/filing-intel'

/** A move this large against the label is worth flagging (typical next-day move is ~3.8%). */
const MIN_MOVE_PCT = 2

/**
 * The market moved clearly against what the filing says, e.g. Arcus's failed Phase 3
 * (negative) closing +5.5% the next session because the failure was already expected.
 * Uses the first close after the filing, else the current price.
 */
export function marketDisagreement(
  filing: Pick<FilingIntelFilingOut, 'signal' | 'ref_close' | 'close_1d'>,
  now: QuoteOut | undefined,
): { move: number; basis: 'next close' | 'now' } | null {
  const label = filing.signal?.label
  if (!filing.ref_close || (label !== 'positive' && label !== 'negative')) return null
  const price = filing.close_1d ?? now?.price
  if (!price) return null
  const move = (price / filing.ref_close - 1) * 100
  const against = label === 'positive' ? move <= -MIN_MOVE_PCT : move >= MIN_MOVE_PCT
  return against ? { move, basis: filing.close_1d ? 'next close' : 'now' } : null
}
