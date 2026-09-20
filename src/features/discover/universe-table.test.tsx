import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { UniverseTable } from './universe-table'
import { universeRow } from './universe-table.test-helpers'

const mockUniverse = vi.fn()

vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useUniverse: () => mockUniverse(),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderTable(items: ReturnType<typeof universeRow>[]) {
  mockUniverse.mockReturnValue({
    data: { items, total: items.length },
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  return renderWithProviders(<UniverseTable />)
}

test('renders a signed score-change cell', () => {
  renderTable([
    universeRow({ ticker: 'UP', score_change_1d: 12.5 }),
    universeRow({ ticker: 'DOWN', score_change_1d: -4 }),
  ])

  expect(screen.getByText('+12.5')).toBeInTheDocument()
  expect(screen.getByText('-4.0')).toBeInTheDocument()
})

test('exposes a sortable score-change header', () => {
  renderTable([universeRow({ ticker: 'UP', score_change_1d: 12.5 })])
  expect(screen.getByRole('button', { name: /Δ Score/ })).toBeInTheDocument()
})

test('shows a placeholder for a ticker with no score history yet', () => {
  renderTable([universeRow({ ticker: 'NEW', score_change_1d: null })])
  expect(screen.getByTestId('score-change-NEW')).toHaveTextContent('—')
})

test('shows an insider badge only on cluster-buy rows', () => {
  renderTable([
    universeRow({ ticker: 'CLUSTER', insider_cluster_buy: true }),
    universeRow({ ticker: 'QUIET', insider_cluster_buy: false }),
  ])

  const badges = screen.getAllByTitle(/insiders bought on the open market/i)
  expect(badges).toHaveLength(1)
})

test('offers an insider quick filter', () => {
  renderTable([universeRow({ ticker: 'CLUSTER', insider_cluster_buy: true })])
  expect(screen.getByRole('button', { name: /insider buying/i })).toBeInTheDocument()
})

test('renders the short interest column', () => {
  renderTable([universeRow({ ticker: 'GME', short_percent_of_float: 23.4 })])

  expect(screen.getByTestId('short-interest-GME')).toHaveTextContent('23.4%')
})

test('renders the float alongside short interest when known', () => {
  renderTable([
    universeRow({ ticker: 'GME', short_percent_of_float: 23.4, float_shares: 51_000_000 }),
  ])

  expect(screen.getByTestId('short-interest-GME')).toHaveTextContent('float')
})

test('renders a dash when short interest is unknown', () => {
  renderTable([universeRow({ ticker: 'NVDA', short_percent_of_float: null })])

  expect(screen.getByTestId('short-interest-NVDA')).toHaveTextContent('—')
})

test('exposes a sortable short interest header', () => {
  renderTable([universeRow({ ticker: 'GME', short_percent_of_float: 23.4 })])

  expect(screen.getByRole('button', { name: /Short %/ })).toBeInTheDocument()
})

test('offers a squeeze quick filter', () => {
  renderTable([universeRow({ ticker: 'GME', short_percent_of_float: 23.4 })])

  expect(screen.getByRole('button', { name: /squeeze/i })).toBeInTheDocument()
})

test('renders the sector percentile column', () => {
  renderTable([universeRow({ ticker: 'NVDA', sector_score_percentile: 82 })])

  expect(screen.getByTestId('sector-percentile-NVDA')).toHaveTextContent('82nd')
})

test('shows the industry percentile alongside the sector one when known', () => {
  renderTable([
    universeRow({ ticker: 'NVDA', sector_score_percentile: 82, industry_score_percentile: 74 }),
  ])

  expect(screen.getByTestId('sector-percentile-NVDA')).toHaveTextContent('Ind. 74th')
})

test('shows a placeholder when the peer group is too small to rank', () => {
  // The backend writes null whenever a sector holds fewer than 5 scored
  // tickers, so this is a common state, not an edge case.
  renderTable([universeRow({ ticker: 'TINY', sector_score_percentile: null })])

  expect(screen.getByTestId('sector-percentile-TINY')).toHaveTextContent('—')
})

test('exposes a sortable sector percentile header', () => {
  renderTable([universeRow({ ticker: 'NVDA', sector_score_percentile: 82 })])

  expect(screen.getByRole('button', { name: /Sector %ile/ })).toBeInTheDocument()
})

// UTC is already Sunday, but New York is still Saturday until 04:00 UTC.
test.each([
  ['2026-09-20T02:00:00Z', '2026-09-24', 5],
  ['2026-09-20T02:00:00Z', '2026-09-19', 0],
  ['2026-09-20T02:00:00Z', '2026-09-26', 7],
  ['2026-09-20T04:00:00Z', '2026-09-24', 4],
  // Crossing the spring/fall DST transitions still counts calendar days.
  ['2026-03-08T04:30:00Z', '2026-03-10', 3],
  ['2026-11-01T03:30:00Z', '2026-11-03', 3],
])('counts earnings from the New York date at %s', (now, earnings, days) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
  renderTable([universeRow({ ticker: 'SNX', next_earnings_date: earnings })])

  expect(screen.getByText(new RegExp(`· ${days} calendar days`))).toBeInTheDocument()
})

test.each(['2026-09-18', '2026-09-27', '2026-11-18'])(
  'leaves earnings outside the New York seven-day window unmarked: %s', (earnings) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-20T02:00:00Z'))
    renderTable([universeRow({ ticker: 'COST', next_earnings_date: earnings })])

    expect(screen.queryByText(/· \d+ calendar days/)).not.toBeInTheDocument()
  },
)
