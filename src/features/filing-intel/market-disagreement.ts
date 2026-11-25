import type { FilingIntelFilingOut, QuoteOut } from '@/types/filing-intel'
import { entryPrice } from './price-chart-model'

/** A move this large against the label is worth flagging (typical next-day move is ~3.8%). */
const MIN_MOVE_PCT = 2

/**
 * The market moved clearly against what the filing says, e.g. Arcus's failed Phase 3
 * (negative) closing +5.5% the next session because the failure was already expected.
 * Uses the first close after the filing, else the current price.
 */
export function marketDisagreement(
  filing: Pick<FilingIntelFilingOut, 'signal' | 'ref_close' | 'close_1d' | 'pre_filing_price' | 'detected_price' | 'entry_price'>,
  now: QuoteOut | undefined,
): { move: number; basis: 'next close' | 'now' } | null {
  const label = filing.signal?.label
  // From the last price before the filing was public: a move already made on a press release
  // that crossed the wire before EDGAR is not the market's answer to the filing.
  const base = entryPrice(filing)
  if (!base || (label !== 'positive' && label !== 'negative')) return null
  const price = filing.close_1d ?? now?.price
  if (!price) return null
  const move = (price / base - 1) * 100
  const against = label === 'positive' ? move <= -MIN_MOVE_PCT : move >= MIN_MOVE_PCT
  return against ? { move, basis: filing.close_1d ? 'next close' : 'now' } : null
}
