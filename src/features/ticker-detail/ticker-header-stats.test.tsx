import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { useEarnings, useUniverseScore } from './hooks'
import { TickerHeaderStats } from './ticker-header-stats'

vi.mock('./hooks', () => ({ useUniverseScore: vi.fn(), useEarnings: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T17:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function mockData(universe: unknown, next: unknown) {
  vi.mocked(useUniverseScore).mockReturnValue({ data: universe, isPending: false } as never)
  vi.mocked(useEarnings).mockReturnValue({ data: { next } } as never)
}

test('shows the universe score and the next earnings countdown', () => {
  mockData(
    { score: 64.2, lean: 'bullish', score_updated_at: '2026-10-07T16:50:00Z' },
    { event_date: '2026-11-17', bmo_amc: 'amc' },
  )
  renderWithProviders(<TickerHeaderStats ticker="NVDA" />)

  expect(screen.getByText('64/100 · bullish')).toBeInTheDocument()
  expect(screen.getByText('Next earnings Nov 17, 2026 · AMC · in 41 days')).toBeInTheDocument()
})

test('renders nothing for a ticker with no score and no earnings', () => {
  mockData(null, null)
  const { container } = renderWithProviders(<TickerHeaderStats ticker="QQQ" />)

  expect(container).toBeEmptyDOMElement()
})
