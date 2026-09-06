import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { SectorRotationEntryOut, SectorRotationOut } from '@/types/api'
import { SectorRotation } from './sector-rotation'

let mockData: SectorRotationOut | undefined

vi.mock('./hooks', () => ({
  useSectorRotation: () => ({ data: mockData, isLoading: false, error: null }),
}))

afterEach(cleanup)

function entry(overrides: Partial<SectorRotationEntryOut> = {}): SectorRotationEntryOut {
  return {
    etf_symbol: 'XLK',
    sector: 'Technology',
    trend_pct: 5,
    rank: 1,
    trend_pct_prior: 4,
    rank_prior: 1,
    rank_change: 0,
    trend_pct_change: 1,
    ...overrides,
  }
}

function payload(overrides: Partial<SectorRotationOut> = {}): SectorRotationOut {
  return {
    window_days: 5,
    as_of: '2026-09-04T20:00:00Z',
    prior_as_of: '2026-08-30T20:00:00Z',
    history_days_available: 20,
    caveat: 'Windows are calendar days.',
    sectors: [entry()],
    ...overrides,
  }
}

test('explains the wait instead of rendering an empty card', () => {
  mockData = payload({
    window_days: 20,
    as_of: null,
    prior_as_of: null,
    history_days_available: 0,
    sectors: [],
  })
  render(<SectorRotation />)
  expect(screen.getByText(/not enough history/i)).toBeInTheDocument()
})

test('sorts risers first, not by current rank', () => {
  mockData = payload({
    sectors: [
      entry({ etf_symbol: 'XLK', sector: 'Technology', rank: 1, rank_change: -2 }),
      entry({ etf_symbol: 'XLE', sector: 'Energy', rank: 2, rank_change: 5 }),
    ],
  })
  render(<SectorRotation />)
  const rows = screen.getAllByTestId('rotation-row')
  expect(rows[0]).toHaveTextContent('Energy')
  expect(rows[1]).toHaveTextContent('Technology')
})

test('renders the caveat as visible text', () => {
  mockData = payload()
  render(<SectorRotation />)
  expect(screen.getByText(/windows are calendar days/i)).toBeInTheDocument()
})

test('shows an unchanged marker rather than a signed zero', () => {
  mockData = payload({ sectors: [entry({ rank_change: 0 })] })
  render(<SectorRotation />)
  expect(screen.getByText('—')).toBeInTheDocument()
})
