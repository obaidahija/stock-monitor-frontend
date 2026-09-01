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

afterEach(cleanup)

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
