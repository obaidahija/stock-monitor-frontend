import { describe, expect, it } from 'vitest'
import { formatValue } from './labels'

describe('formatValue list items', () => {
  it('reads revenue targets, notes, milestones and exhibits as words', () => {
    expect(
      formatValue('targets', [
        {
          period: '2027',
          metric: 'revenue',
          bound: 'at least',
          value: 1.1e9,
          stance: 'new',
        },
      ]),
    ).toMatch(/^2027 revenue ≥ \$1\.1\s?B \(new\)$/)
    expect(
      formatValue('notes', [{ coupon_pct: 2.869, maturity_year: 2029 }]),
    ).toBe('2.869% due 2029')
    expect(
      formatValue('milestones', [
        { kind: 'first_dosed', text: 'First participant dosed' },
      ]),
    ).toBe('First dosed: First participant dosed')
    expect(
      formatValue('exhibits', [
        { number: '1.1', description: 'Underwriting Agreement' },
      ]),
    ).toBe('1.1 Underwriting Agreement')
  })
})
