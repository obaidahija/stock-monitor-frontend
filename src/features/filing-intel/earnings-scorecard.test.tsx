import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { Scorecard } from '@/types/filing-intel'
import { EarningsScorecard, ScorecardMiniTable } from './earnings-scorecard'

afterEach(cleanup)

const NVDA: Scorecard = {
  rows: [
    { metric: 'eps', basis: 'adjusted', label: 'Adjusted EPS', unit: 'per_share', expected: 2.47, actual: 2.68,
      difference: 0.21, surprise_pct: 8.5, result: 'beat', prior_year: 1.27, yoy_pct: 111.02, yoy_source: 'release',
      prior_quarter: 2.22, qoq_pct: 20.72, qoq_source: 'earnings calendar actual (Aug 26, 2026)' },
    { metric: 'revenue', basis: 'reported', label: 'Revenue', unit: 'usd', expected: 108.71e9, actual: 115.844e9,
      difference: 7.1e9, surprise_pct: 6.56, result: 'beat', prior_year: 57.006e9, yoy_pct: 103.21, yoy_source: 'release',
      prior_quarter: null, qoq_pct: null, qoq_source: null },
  ],
}

test('the table shows expected, actual and the beat, then the change on a year and a quarter', () => {
  render(<EarningsScorecard scorecard={NVDA} />)
  expect(screen.getByRole('columnheader', { name: 'Beat / Miss' })).toBeInTheDocument()
  expect(screen.getByText('$2.47')).toBeInTheDocument()
  expect(screen.getByText('$2.68')).toBeInTheDocument()
  expect(screen.getByText('Beat by 8.5%')).toBeInTheDocument()
  expect(screen.getByText('Beat by 6.6%')).toBeInTheDocument()
  expect(screen.getByText('up 111%')).toBeInTheDocument()
  expect(screen.getByText('up 20.7%')).toBeInTheDocument()
  // No previous-quarter revenue: a dash, with the reason on hover.
  expect(screen.getAllByText('—').length).toBe(1)
})

test('row table: the panel columns plus YoY and QoQ, and the guidance on one line', () => {
  const raised = {
    event_type: 'guidance', item: '2.02', topic: null, direction: 'positive' as const, method: 'rule' as const,
    fields: { metric: 'adjusted_eps', period: 'FY', low: 11.7, high: 11.8, unit: 'USD/shares', change: 'raised', prior_low: 11.45, prior_high: 11.65 },
    evidence: [],
  }
  render(<ScorecardMiniTable scorecard={NVDA} events={[raised]} />)
  expect(screen.getByRole('columnheader', { name: 'QoQ' })).toBeInTheDocument()
  expect(screen.getByText('Beat by 8.5%')).toBeInTheDocument()
  expect(screen.getByText('+111%')).toBeInTheDocument()
  expect(screen.getByText('+20.7%')).toBeInTheDocument()
  expect(screen.getByText('raised', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('(was $11.45–$11.65)', { exact: false })).toBeInTheDocument()
})

test('nothing without a scorecard', () => {
  const { container } = render(<EarningsScorecard scorecard={null} />)
  expect(container).toBeEmptyDOMElement()
})
