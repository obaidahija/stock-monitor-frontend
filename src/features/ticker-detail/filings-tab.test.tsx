import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getFilingChanges } from '@/api/filing-changes'
import { useFilings } from './hooks'
import { FilingsTab } from './filings-tab'

vi.mock('./hooks', () => ({ useFilings: vi.fn() }))
vi.mock('@/api/filing-changes', () => ({
  getFilingChanges: vi.fn(),
  compareAnnualFilings: vi.fn(),
  getFilingChangePage: vi.fn(),
  explainFilingChanges: vi.fn(),
}))

function renderTab(ticker = 'NVDA') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <FilingsTab ticker={ticker} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getFilingChanges).mockResolvedValue(null)
})
afterEach(cleanup)

test('comparison action exists when recent filings are empty', async () => {
  vi.mocked(useFilings).mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never)

  renderTab()

  expect(
    screen.getByRole('button', { name: /compare latest annual filings/i }),
  ).toBeInTheDocument()
  expect(screen.getByText('No recent filings')).toBeInTheDocument()
})

test('comparison action survives a failed recent-filings request', async () => {
  vi.mocked(useFilings).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: true,
    error: new Error('filings unavailable'),
    refetch: vi.fn(),
  } as never)

  renderTab()

  expect(
    screen.getByRole('button', { name: /compare latest annual filings/i }),
  ).toBeInTheDocument()
  expect(screen.getByText('filings unavailable')).toBeInTheDocument()
})

test('comparison action renders while recent filings are still loading', async () => {
  vi.mocked(useFilings).mockReturnValue({
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never)

  renderTab()

  expect(
    screen.getByRole('button', { name: /compare latest annual filings/i }),
  ).toBeInTheDocument()
  await waitFor(() => expect(getFilingChanges).toHaveBeenCalledWith('NVDA'))
})
