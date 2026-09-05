import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { EarningsPlaybookOut } from '@/types/api'
import { EarningsPlaybookCard } from './earnings-playbook-card'

let mockData: EarningsPlaybookOut | undefined

vi.mock('./hooks', () => ({
  useEarningsPlaybook: () => ({ data: mockData, isPending: false }),
}))

afterEach(cleanup)

function payload(overrides: Partial<EarningsPlaybookOut> = {}): EarningsPlaybookOut {
  return {
    ticker: 'AAPL',
    reaction_quarters: 8,
    reaction_mean_pct: 1.2,
    reaction_median_pct: 0.9,
    reaction_mean_abs_pct: 4.6,
    up_count: 5,
    down_count: 3,
    direction_consistency_pct: 62.5,
    drift: [
      { horizon_days: 1, mean_pct: 0.4, median_pct: 0.3, quarters: 8 },
      { horizon_days: 5, mean_pct: 1.1, median_pct: 0.8, quarters: 7 },
      { horizon_days: 20, mean_pct: -2.2, median_pct: -1.9, quarters: 5 },
    ],
    quarters: [],
    days_until_next_earnings: 12,
    source: { ok: true, error: null },
    ...overrides,
  }
}

test('leads with the typical move', () => {
  mockData = payload()
  render(<EarningsPlaybookCard ticker="AAPL" />)
  expect(screen.getByText(/4\.6%/)).toBeInTheDocument()
})

test('labels each drift horizon with its own quarter count', () => {
  mockData = payload()
  render(<EarningsPlaybookCard ticker="AAPL" />)
  // The +20 horizon has 5 usable quarters while +1 has 8; both must show.
  expect(screen.getByTestId('drift-1')).toHaveTextContent('8')
  expect(screen.getByTestId('drift-20')).toHaveTextContent('5')
})

test('explains the absence instead of rendering empty stats', () => {
  mockData = payload({
    reaction_quarters: 0,
    reaction_mean_pct: null,
    reaction_median_pct: null,
    reaction_mean_abs_pct: null,
    up_count: 0,
    down_count: 0,
    direction_consistency_pct: null,
    drift: [
      { horizon_days: 1, mean_pct: null, median_pct: null, quarters: 0 },
      { horizon_days: 5, mean_pct: null, median_pct: null, quarters: 0 },
      { horizon_days: 20, mean_pct: null, median_pct: null, quarters: 0 },
    ],
  })
  render(<EarningsPlaybookCard ticker="AAPL" />)
  expect(screen.getByText(/no usable earnings reactions/i)).toBeInTheDocument()
})
