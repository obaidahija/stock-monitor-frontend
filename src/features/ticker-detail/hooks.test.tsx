import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { getAnalysis, getCompetitors, refreshCompetitors, refreshUniverseScore } from '@/api/stocks'
import type { GoogleFinanceCompetitorsOut } from '@/types/api'
import { useAnalysis, useAutoRefreshUniverseScore, useRefreshCompetitors } from './hooks'

vi.mock('@/api/stocks', () => ({
  getAnalysis: vi.fn().mockResolvedValue({ ticker: 'NVDA' }),
  refreshCompetitors: vi.fn(),
  getCompetitors: vi.fn(),
  refreshUniverseScore: vi.fn().mockResolvedValue({
    ticker: 'TEAM',
    scored: true,
    score: 80,
    news_classified: 0,
  }),
}))

function AutoRefreshHarness({ ticker }: { ticker: string }) {
  useAutoRefreshUniverseScore(ticker)
  return null
}

afterEach(cleanup)

test('refreshes the universe score once when the stock ticker is visited', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  const { rerender } = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AutoRefreshHarness ticker="TEAM" />
      </QueryClientProvider>
    </StrictMode>,
  )

  await waitFor(() => expect(refreshUniverseScore).toHaveBeenCalledTimes(1))
  expect(refreshUniverseScore).toHaveBeenLastCalledWith('TEAM')

  rerender(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AutoRefreshHarness ticker="AAPL" />
      </QueryClientProvider>
    </StrictMode>,
  )

  await waitFor(() => expect(refreshUniverseScore).toHaveBeenCalledTimes(2))
  expect(refreshUniverseScore).toHaveBeenLastCalledWith('AAPL')
})

function AnalysisHarness({ horizonSessions }: { horizonSessions?: number }) {
  useAnalysis('NVDA', horizonSessions === undefined ? {} : { horizonSessions })
  return null
}

test('a different research window is a different cached analysis', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const { rerender } = render(
    <QueryClientProvider client={queryClient}>
      <AnalysisHarness horizonSessions={3} />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(getAnalysis).toHaveBeenCalledWith('NVDA', { horizonSessions: 3 }))

  rerender(
    <QueryClientProvider client={queryClient}>
      <AnalysisHarness horizonSessions={5} />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(getAnalysis).toHaveBeenCalledWith('NVDA', { horizonSessions: 5 }))

  rerender(
    <QueryClientProvider client={queryClient}>
      <AnalysisHarness />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(getAnalysis).toHaveBeenCalledWith('NVDA', {}))
  expect(queryClient.getQueryCache().findAll({ queryKey: ['analysis', 'NVDA'] })).toHaveLength(3)
})

function CompetitorSearchHarness({ ticker, forceRefresh = false }: { ticker: string; forceRefresh?: boolean }) {
  const search = useRefreshCompetitors(ticker)
  return <button onClick={() => search.mutate(forceRefresh)}>Search</button>
}

test('a search completing after navigation saves under its response ticker', async () => {
  let resolve!: (value: GoogleFinanceCompetitorsOut) => void
  vi.mocked(refreshCompetitors).mockReturnValue(new Promise((done) => { resolve = done }))
  const queryClient = new QueryClient()
  const nvdaSaved = { ticker: 'NVDA', answer_markdown: 'AMD is a competitor.' }
  queryClient.setQueryData(['google-finance-competitors', 'NVDA'], nvdaSaved)
  const { rerender } = render(
    <QueryClientProvider client={queryClient}>
      <CompetitorSearchHarness ticker="WDC" />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(refreshCompetitors).toHaveBeenCalledWith('WDC', false))
  rerender(
    <QueryClientProvider client={queryClient}>
      <CompetitorSearchHarness ticker="NVDA" />
    </QueryClientProvider>,
  )
  const response: GoogleFinanceCompetitorsOut = {
    ticker: 'WDC', snapshot_id: 1, question: 'Who competes with WDC?',
    answer_markdown: 'Seagate competes in HDDs.', sources: [],
    generated_at: '2026-10-02T09:30:00Z', cached: false, caveat: 'Informational only.',
    source: { name: 'google_finance', ok: true, fetched_at: '2026-10-02T09:30:00Z',
      error: null, latency_ms: null },
  }
  await act(async () => { resolve(response) })
  expect(queryClient.getQueryData(['google-finance-competitors', 'WDC'])).toEqual(response)
  expect(queryClient.getQueryData(['google-finance-competitors', 'NVDA'])).toEqual(nvdaSaved)
})

test('a late background read cannot overwrite the newly refreshed response', async () => {
  const previous: GoogleFinanceCompetitorsOut = {
    ticker: 'WDC', snapshot_id: 1, question: 'Who competes with WDC?',
    answer_markdown: 'Previous answer.', sources: [],
    generated_at: '2026-10-02T09:30:00Z', cached: true, caveat: 'Informational only.',
    source: { name: 'google_finance', ok: true, fetched_at: '2026-10-02T09:30:00Z',
      error: null, latency_ms: null },
  }
  const refreshed = { ...previous, answer_markdown: 'New answer.', cached: false,
    generated_at: '2026-10-02T10:30:00Z',
    source: { ...previous.source, fetched_at: '2026-10-02T10:30:00Z' } }
  let resolveRead!: (value: GoogleFinanceCompetitorsOut) => void
  let resolveSearch!: (value: GoogleFinanceCompetitorsOut) => void
  vi.mocked(getCompetitors).mockReturnValue(new Promise((done) => { resolveRead = done }))
  vi.mocked(refreshCompetitors).mockReturnValue(new Promise((done) => { resolveSearch = done }))
  const queryClient = new QueryClient()
  const key = ['google-finance-competitors', 'WDC']
  queryClient.setQueryData(key, previous)
  const pendingRead = queryClient.fetchQuery({ queryKey: key, queryFn: () => getCompetitors('WDC') })
    .catch(() => undefined)
  render(
    <QueryClientProvider client={queryClient}>
      <CompetitorSearchHarness ticker="WDC" forceRefresh />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(refreshCompetitors).toHaveBeenCalledWith('WDC', true))
  await act(async () => { resolveSearch(refreshed) })
  await waitFor(() => expect(queryClient.getQueryData(key)).toEqual(refreshed))
  await act(async () => { resolveRead(previous); await pendingRead })
  expect(queryClient.getQueryData(key)).toEqual(refreshed)
})
