import { expect, test } from 'vitest'
import type { StockPairItemOut, StockPairWindowOut } from '@/types/api'
import { rankPairItems } from './pair-ranking'
import { fund, seagate, sixMonth, threeMonth } from './test-fixtures'

function measured(base: StockPairWindowOut, correlation: number | null, sampleSize?: number) {
  return { ...base, correlation, sample_size: sampleSize ?? base.sample_size }
}

function candidate(
  ticker: string,
  six: number | null,
  three: number | null = six,
  overrides: Partial<StockPairItemOut> = {},
): StockPairItemOut {
  return {
    ...seagate,
    ticker,
    six_month: measured(sixMonth, six),
    three_month: measured(threeMonth, three),
    ...overrides,
  }
}

const tickers = (items: readonly StockPairItemOut[]) => items.map((item) => item.ticker)

test('candidates sort by descending correlation in the selected window', () => {
  const items = [candidate('A', 0.52), candidate('B', 0.86), candidate('C', 0.73)]

  expect(tickers(rankPairItems(items, 'six_month'))).toEqual(['B', 'C', 'A'])
})

test('a large negative correlation never outranks a smaller positive one', () => {
  const items = [candidate('POS', 0.4), candidate('NEG', -0.95)]

  expect(tickers(rankPairItems(items, 'six_month'))).toEqual(['POS', 'NEG'])
})

test('values that display alike still sort at full precision', () => {
  // Both show as 0.82.
  const items = [candidate('LOW', 0.8212), candidate('HIGH', 0.8249)]

  expect(tickers(rankPairItems(items, 'six_month'))).toEqual(['HIGH', 'LOW'])
})

test('exact ties keep Google order', () => {
  const items = [candidate('FIRST', 0.7), candidate('TOP', 0.9), candidate('SECOND', 0.7)]

  expect(tickers(rankPairItems(items, 'six_month'))).toEqual(['TOP', 'FIRST', 'SECOND'])
})

test('candidates that cannot be ranked follow in Google order', () => {
  const items = [
    candidate('FLAT', null),
    { ...fund, ticker: 'ETF' },
    candidate('SHORT', 0.99, 0.99, { six_month: measured(sixMonth, 0.99, 99) }),
    candidate('FAILED', 0.9, 0.9, { evidence_status: 'price_unavailable' }),
    candidate('STALE', 0.8, 0.8, { evidence_status: 'price_stale' }),
    candidate('BADID', 0.95, 0.95, { evidence_status: 'invalid_security' }),
    candidate('ODD', Number.NaN),
    candidate('OK', 0.1),
  ]

  expect(tickers(rankPairItems(items, 'six_month'))).toEqual([
    'OK',
    'FLAT',
    'ETF',
    'SHORT',
    'FAILED',
    'STALE',
    'BADID',
    'ODD',
  ])
})

test('the selected window ranks even when the other window is insufficient', () => {
  const recent = candidate('RECENT', 0.95, 0.9, {
    evidence_status: 'insufficient_data',
    six_month: measured(sixMonth, 0.95, 99),
  })
  const items = [candidate('STEADY', 0.2, 0.3), recent]

  expect(tickers(rankPairItems(items, 'three_month'))).toEqual(['RECENT', 'STEADY'])
  expect(tickers(rankPairItems(items, 'six_month'))).toEqual(['STEADY', 'RECENT'])
})

test('three months needs at least 40 aligned returns to rank', () => {
  const items = [
    candidate('THIN', 0.9, 0.9, { three_month: measured(threeMonth, 0.9, 39) }),
    candidate('ENOUGH', 0.5, 0.5, { three_month: measured(threeMonth, 0.5, 40) }),
  ]

  expect(tickers(rankPairItems(items, 'three_month'))).toEqual(['ENOUGH', 'THIN'])
})

test('ranking returns a new array and never touches the cached items', () => {
  const items: readonly StockPairItemOut[] = Object.freeze([
    candidate('A', 0.1),
    candidate('B', 0.9),
  ])
  const before = JSON.stringify(items)

  const ranked = rankPairItems(items, 'six_month')

  expect(ranked).not.toBe(items)
  expect(tickers(ranked)).toEqual(['B', 'A'])
  expect(ranked[0]).toBe(items[1])
  expect(JSON.stringify(items)).toBe(before)
})
