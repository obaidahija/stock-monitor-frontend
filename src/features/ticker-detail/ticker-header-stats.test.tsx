import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { useEarnings, useUniverseScore, useQuote, useIndustryPerformance } from './hooks'
import { TickerHeaderStats } from './ticker-header-stats'

vi.mock('./hooks', () => ({ useUniverseScore: vi.fn(), useEarnings: vi.fn(), useQuote: vi.fn(), useIndustryPerformance: vi.fn() }))

beforeEach(() => {
  vi.mocked(useIndustryPerformance).mockReturnValue(null)
  vi.mocked(useQuote).mockReturnValue({ data: null } as never)
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

test('shows company and live quote details, including zero volume', () => {
  mockData({ market_cap: 2500000000, avg_volume_20d: 1200000, sector: 'Technology' }, null)
  vi.mocked(useQuote).mockReturnValue({ data: { pe_ratio: 24.56, volume: 0, previous_close: 123.45 } } as never)
  renderWithProviders(<TickerHeaderStats ticker="NVDA" />)
  expect(screen.getByText('$2.5B')).toBeInTheDocument()
  expect(screen.getByText('24.56x')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByText('1.2M')).toBeInTheDocument()
  expect(screen.getByText('$123.45')).toBeInTheDocument()
  expect(screen.getByText('Technology')).toBeInTheDocument()
})

test('shows placeholders for missing fundamentals without inventing values', () => {
  mockData(null, null)
  vi.mocked(useQuote).mockReturnValue({ data: { pe_ratio: null } } as never)
  renderWithProviders(<TickerHeaderStats ticker="QQQ" />)
  expect(screen.getAllByText('—')).toHaveLength(7)
})

test.each([
  [1.25, 'Up +1.25% today', 'text-emerald-600'],
  [-0.82, 'Down -0.82% today', 'text-red-600'],
  [0, 'Flat 0.00% today', 'text-muted-foreground'],
])('shows industry direction for a %s percent daily move', (change, text, color) => {
  mockData({ sector: 'Technology', industry: 'Semiconductors' }, null)
  vi.mocked(useIndustryPerformance).mockReturnValue({ avg_change_pct: change } as never)
  renderWithProviders(<TickerHeaderStats ticker="NVDA" />)
  expect(screen.getByText('Semiconductors')).toBeInTheDocument()
  expect(screen.getByText(text)).toHaveClass(color)
  expect(useIndustryPerformance).toHaveBeenCalledWith('Technology', 'Semiconductors')
})

test('keeps the industry visible when its daily change is unavailable', () => {
  mockData({ sector: 'Technology', industry: 'Semiconductors' }, null)
  renderWithProviders(<TickerHeaderStats ticker="NVDA" />)
  expect(screen.getByText('Semiconductors')).toBeInTheDocument()
  expect(screen.getByText('Daily change unavailable')).toBeInTheDocument()
})
