import { expect, test } from 'vitest'
import type { FilingKeyFact } from '@/types/api'
import { buildFigureRows, commonPeriod, figureAmount } from './earnings-figures'

const base: FilingKeyFact = {
  metric: 'revenue', label: 'Revenue', value: '115,844', currency: '$', unit: 'million',
  period: 'quarter ended October 25, 2026', period_end: '2026-10-25', period_kind: 'quarter',
  basis: 'reported', importance: 'high', warning: false, change: null, evidence: [],
}

test('dollar totals read compact; per-share and percent values keep their wording', () => {
  expect(figureAmount(base)).toBe('$115.84B')
  expect(figureAmount({ ...base, value: '(1,299)' })).toBe('-$1.3B')
  expect(figureAmount({ ...base, value: '130 to 140' })).toBe('$130 to 140 million')
  expect(figureAmount({ ...base, metric: 'eps', value: '2.68', unit: 'per share' })).toBe('$2.68')
  expect(figureAmount({ ...base, value: '74.8', currency: null, unit: '%' })).toBe('74.8%')
  // A non-dollar currency is never relabelled as dollars.
  expect(figureAmount({ ...base, currency: '€' })).toBe('€115,844 million')
})

test('the same figure stated twice is shown once, keeping the copy with a year-ago value', () => {
  const rows = buildFigureRows([
    { ...base, metric: 'eps', label: 'EPS', basis: 'gaap', value: '2.70', unit: null },
    { ...base, metric: 'eps', label: 'EPS', basis: 'reported', value: '2.70', unit: 'per share', prior_value: '1.30', yoy_change: '+107.7%' },
  ])
  expect(rows).toHaveLength(1)
  expect(rows[0].cells.reported?.yoy_change).toBe('+107.7%')
})

test('an undated adjusted statement joins the dated reported row', () => {
  const rows = buildFigureRows([
    base,
    { ...base, basis: 'adjusted', value: '115.8', unit: 'billion', period_end: null, period: 'Q3 FY27' },
  ])
  expect(rows).toHaveLength(1)
  expect(rows[0].cells.reported?.value).toBe('115,844')
  expect(rows[0].cells.adjusted?.value).toBe('115.8')
  expect(rows[0].period).toBe('Quarter · Oct 25, 2026')
})

test('differing values for one figure stay visible as separate rows', () => {
  const rows = buildFigureRows([base, { ...base, value: '116,000' }])
  expect(rows).toHaveLength(2)
  expect(new Set(rows.map((row) => row.key)).size).toBe(2)
})

test('different periods never merge, guidance is left out and important figures come first', () => {
  const rows = buildFigureRows([
    { ...base, metric: 'cash', label: 'Cash', importance: 'medium', period_kind: 'instant' },
    { ...base, metric: 'guidance', label: 'Guidance', value: 'Revenue of $130 billion' },
    base,
    { ...base, period_kind: 'annual', period_end: '2026-10-25', value: '400,000' },
  ])
  expect(rows.map((row) => row.label)).toEqual(['Revenue', 'Revenue', 'Cash'])
  expect(commonPeriod(rows)).toBe('Quarter · Oct 25, 2026')
})
