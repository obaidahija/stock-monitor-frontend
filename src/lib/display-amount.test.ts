import { expect, test } from 'vitest'
import type { FilingKeyFact } from '@/types/api'
import { displayAmount } from './display-amount'

const fact = (overrides: Partial<FilingKeyFact>): FilingKeyFact => ({
  metric: 'revenue', label: 'Revenue', value: '10,409', currency: '$', unit: 'million',
  period: 'October 25, 2026', period_end: '2026-10-25', period_kind: 'quarter', basis: 'reported',
  importance: 'high', warning: false, change: null, evidence: [], ...overrides,
})

test('prefixes the currency to a plain amount', () => {
  expect(displayAmount(fact({}), '10,409')).toBe('$10,409 million')
})

test('keeps a guidance row in its own words without an extra currency sign', () => {
  const guidance = fact({ metric: 'guidance', currency: null, value: 'Total revenue $ 11,100 +/- $ 500' })
  expect(displayAmount(guidance, guidance.value)).toBe('Total revenue $ 11,100 +/- $ 500 million')
})

test('a margin reads as a percentage', () => {
  expect(displayAmount(fact({ metric: 'gross_margin', currency: null, unit: '%', value: '50.4' }), '50.4')).toBe('50.4%')
})

test('a percentage already written with its sign is not marked twice', () => {
  const margin = fact({ metric: 'gross_margin', currency: null, unit: '%', value: '50.4%' })
  expect(displayAmount(margin, '50.4%')).toBe('50.4%')
  expect(displayAmount(margin, '50.4 %')).toBe('50.4 %')
  expect(displayAmount(margin, '30% to 32%')).toBe('30% to 32%')
})

test('an absent value shows nothing rather than a bare unit', () => {
  expect(displayAmount(fact({}), '')).toBe('')
})
