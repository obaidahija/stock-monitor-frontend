import { expect, test } from 'vitest'
import { marketDisagreement } from './market-disagreement'

const negative = { label: 'negative' as const, strength: 'single' as const, reasons: [], version: 2 }

test('a negative filing followed by a clear rise is flagged (Arcus, PRISM-1)', () => {
  expect(marketDisagreement({ signal: negative, ref_close: 15.62, close_1d: 16.48 }, undefined)).toEqual({
    move: expect.closeTo(5.5, 1),
    basis: 'next close',
  })
})

test('small or agreeing moves are not flagged', () => {
  expect(marketDisagreement({ signal: negative, ref_close: 15.62, close_1d: 15.8 }, undefined)).toBeNull()
  expect(marketDisagreement({ signal: negative, ref_close: 15.62, close_1d: 14.0 }, undefined)).toBeNull()
  expect(marketDisagreement({ signal: null, ref_close: 15.62, close_1d: 19 }, undefined)).toBeNull()
})

test('before the next close the current price is used', () => {
  const now = { ticker: 'X', price: 19.5, session: 'post' as const, time: null }
  expect(marketDisagreement({ signal: negative, ref_close: 15.62, close_1d: null }, now)?.basis).toBe('now')
})
