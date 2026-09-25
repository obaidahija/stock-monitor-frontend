import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { getAnalysis, refreshUniverseScore } from '@/api/stocks'
import { useAnalysis, useAutoRefreshUniverseScore } from './hooks'

vi.mock('@/api/stocks', () => ({
  getAnalysis: vi.fn().mockResolvedValue({ ticker: 'NVDA' }),
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
