import { expect, test } from 'vitest'
import type { QuoteOut } from '@/types/api'
import { shouldAcceptQuote } from './quote-version'

const FRIDAY_CLOSE = '2026-10-23T20:00:00Z'

function quote(overrides: Partial<QuoteOut> = {}): QuoteOut {
  return {
    ticker: 'AAA',
    price: 10,
    change_amount: null,
    change_pct: null,
    regular_market_time: FRIDAY_CLOSE,
    session_price: 10,
    session_change_amount: null,
    session_change_pct: null,
    market_session: 'closed',
    session_time: FRIDAY_CLOSE,
    ...overrides,
  }
}

const untimed = quote({ regular_market_time: null, session_time: null })

test('anything is accepted into an empty cache', () => {
  expect(shouldAcceptQuote(untimed, undefined)).toBe(true)
})

test('a newer provider observation replaces an older one and never the reverse', () => {
  const older = quote({ regular_market_time: '2026-10-23T14:00:00Z', session_time: '2026-10-23T14:00:00Z' })
  const newer = quote({ regular_market_time: '2026-10-23T14:01:00Z', session_time: '2026-10-23T14:01:00Z' })

  expect(shouldAcceptQuote(newer, older)).toBe(true)
  expect(shouldAcceptQuote(older, newer)).toBe(false)
})

test('a pre-market print is newer than the regular close it follows', () => {
  const closed = quote()
  const preMarket = quote({ market_session: 'pre_market', session_time: '2026-10-26T12:00:00Z' })

  expect(shouldAcceptQuote(preMarket, closed)).toBe(true)
  expect(shouldAcceptQuote(closed, preMarket)).toBe(false)
})

test('the regular-session time breaks a session-time tie', () => {
  const session = '2026-10-26T12:00:00Z'
  const staleRegular = quote({ session_time: session, regular_market_time: '2026-10-22T20:00:00Z' })
  const currentRegular = quote({ session_time: session, regular_market_time: FRIDAY_CLOSE })

  expect(shouldAcceptQuote(currentRegular, staleRegular)).toBe(true)
  expect(shouldAcceptQuote(staleRegular, currentRegular)).toBe(false)
})

test('an untimed quote cannot replace a timed one, but a timed one replaces it', () => {
  expect(shouldAcceptQuote(untimed, quote())).toBe(false)
  expect(shouldAcceptQuote(quote(), untimed)).toBe(true)
})

test('an unparseable time counts as missing', () => {
  const garbled = quote({ regular_market_time: 'not a time', session_time: 'not a time' })

  expect(shouldAcceptQuote(garbled, quote())).toBe(false)
})

test('the later-issued request wins a tie, whether timed or untimed', () => {
  expect(shouldAcceptQuote(quote({ price: 11 }), quote(), { incoming: 2, current: 1 })).toBe(true)
  expect(shouldAcceptQuote(quote({ price: 11 }), quote(), { incoming: 1, current: 2 })).toBe(false)
  expect(shouldAcceptQuote(untimed, untimed, { incoming: 4, current: 3 })).toBe(true)
  expect(shouldAcceptQuote(untimed, untimed, { incoming: 3, current: 4 })).toBe(false)
})
