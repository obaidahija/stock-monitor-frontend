import { describe, expect, it } from 'vitest'
import { marketDisagreement } from './market-disagreement'
import { moveBase } from './price-move'

// Insmed 2026-11-24: $149.09 close, $170.61 pre-market before the 06:04 ET 8-K, $170.15 next close.
const insm = {
  detected_price: 170.61,
  detected_price_session: 'pre' as const,
  detected_price_time: '2026-11-24T11:01:36Z',
  ref_close: 149.09,
  ref_close_date: '2026-11-23',
  close_1d: 170.15,
  close_1d_date: '2026-11-24',
  close_5d: null,
  close_5d_date: null,
  pre_filing_price: 170.61,
  pre_filing_move_pct: 14.43,
}

describe('moves after a filing whose news came out first', () => {
  it('start from the price before the filing, not the last close', () => {
    expect(moveBase(insm)).toBe(170.61)
    expect(moveBase({ ...insm, pre_filing_price: null })).toBe(149.09)
  })

  it('do not count the pre-filing jump as the market agreeing or disagreeing', () => {
    const signal = { label: 'negative' } as never
    expect(marketDisagreement({ signal, ref_close: 149.09, close_1d: 170.15, pre_filing_price: null }, undefined)).not.toBeNull()
    expect(marketDisagreement({ signal, ref_close: 149.09, close_1d: 170.15, pre_filing_price: 170.61 }, undefined)).toBeNull()
  })
})
