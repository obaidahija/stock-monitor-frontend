import { expect, test } from 'vitest'
import type { DigestItem } from '@/types/api'
import { PROMINENT_LIMIT, selectDigestPresentation } from './presentation'

function item(ticker: string, section = 'premarket_gap', stages = [section]): DigestItem {
  return {
    ticker,
    section,
    tier: 3,
    reasons: [`${ticker} reason`],
    stages,
    premarket: null,
    premarket_gap_pct: null,
    volume_ratio: null,
    pct_from_12wk_avg: null,
    recent_pattern: null,
    top_filing: null,
    top_earnings: null,
    news_count_24h: 0,
    headline_snippets: [],
    sentiment: null,
  }
}

const tickers = (items: DigestItem[]) => items.map((entry) => entry.ticker)
const twenty = Array.from({ length: 20 }, (_, index) => item(`T${String(index).padStart(2, '0')}`))

test('shows at most twelve cards besides the three Research First tickers', () => {
  const result = selectDigestPresentation(twenty, ['T00', 'T01', 'T02'], [])

  expect(PROMINENT_LIMIT).toBe(12)
  expect(result.total).toBe(20)
  expect(tickers(result.prominent)).toEqual(tickers(twenty.slice(3, 15)))
  // Nothing is lost: everything not prominent stays in coverage, in order.
  expect(tickers(result.remaining)).toEqual(['T00', 'T01', 'T02', ...tickers(twenty.slice(15))])
  expect(new Set([...tickers(result.prominent), ...tickers(result.remaining)]).size).toBe(20)
})

test('routine filings never pad the prominent slots', () => {
  const items = [
    item('GAP1'),
    item('RTN1', 'other_filings', ['filing']),
    item('GAP2'),
    ...Array.from({ length: 5 }, (_, index) => item(`RTN${index + 2}`, 'other_filings', ['filing'])),
  ]

  const result = selectDigestPresentation(items, [], [])

  expect(tickers(result.prominent)).toEqual(['GAP1', 'GAP2'])
  expect(tickers(result.remaining)).toEqual(['RTN1', 'RTN2', 'RTN3', 'RTN4', 'RTN5', 'RTN6'])
})

test('a legacy payload without sections and an empty Research First still render', () => {
  const legacy = { ...item('OLD'), section: undefined, tier: 1 }

  const result = selectDigestPresentation([legacy], [], [])

  expect(tickers(result.prominent)).toEqual(['OLD'])
  expect(result.remaining).toEqual([])
})

test('a stage filter shows every match without exclusions; clearing restores the compact view', () => {
  const routine = item('RTN', 'other_filings', ['filing'])
  const items = [...twenty, routine]

  const filtered = selectDigestPresentation(items, ['T00', 'T01', 'T02'], ['premarket_gap'])

  expect(tickers(filtered.prominent)).toEqual(tickers(twenty))
  expect(tickers(filtered.remaining)).toEqual(['RTN'])
  expect(filtered.total).toBe(21)
  expect(selectDigestPresentation(items, ['T00', 'T01', 'T02'], ['filing']).prominent).toEqual([
    routine,
  ])

  const cleared = selectDigestPresentation(items, ['T00', 'T01', 'T02'], [])
  expect(cleared.prominent).toHaveLength(12)
})

test('changing the Research First tickers recomputes the exclusions', () => {
  const first = selectDigestPresentation(twenty, ['T00', 'T01', 'T02'], [])
  const second = selectDigestPresentation(twenty, ['T10', 'T11'], [])

  expect(tickers(first.prominent)).not.toContain('T00')
  expect(tickers(second.prominent)).toContain('T00')
  expect(tickers(second.prominent)).not.toContain('T10')
  expect(second.prominent).toHaveLength(12)
})
