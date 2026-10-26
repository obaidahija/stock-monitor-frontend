import { StrictMode, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  getAiResearch,
  getAnalysis,
  getCompetitors,
  getQuote,
  refreshAiResearch,
  refreshCompetitors,
  refreshQuote,
  refreshUniverseScore,
} from '@/api/stocks'
import type { AiResearchOut, GoogleFinanceCompetitorsOut, QuoteOut } from '@/types/api'
import {
  useAiResearch,
  useAnalysis,
  useAutoRefreshQuote,
  useAutoRefreshUniverseScore,
  useQuote,
  useRefreshAiResearch,
  useRefreshCompetitors,
  useRefreshQuote,
} from './hooks'

vi.mock('@/api/stocks', () => ({
  getAnalysis: vi.fn().mockResolvedValue({ ticker: 'NVDA' }),
  refreshCompetitors: vi.fn(),
  getCompetitors: vi.fn(),
  getQuote: vi.fn(),
  refreshQuote: vi.fn(),
  getAiResearch: vi.fn(),
  refreshAiResearch: vi.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function quote(ticker: string, price: number, time: string | null): QuoteOut {
  return {
    ticker,
    price,
    change_amount: null,
    change_pct: null,
    regular_market_time: time,
    session_price: price,
    session_change_amount: null,
    session_change_pct: null,
    market_session: 'regular',
    session_time: time,
  }
}

const AT_1000 = '2026-10-23T14:00:00Z'
const AT_1001 = '2026-10-23T14:01:00Z'

function quoteClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function withClient(client: QueryClient, children: ReactNode) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function AutoQuoteHarness({ ticker }: { ticker: string }) {
  useAutoRefreshQuote(ticker)
  return null
}

function QuoteReader({ ticker }: { ticker: string }) {
  useQuote(ticker)
  return null
}

function RefreshQuoteButton({ ticker }: { ticker: string }) {
  const refresh = useRefreshQuote(ticker)
  return <button onClick={() => refresh.mutate()}>Refresh quote</button>
}

function RefreshQuoteHarness({ ticker, read = false }: { ticker: string; read?: boolean }) {
  return (
    <>
      {read && <QuoteReader ticker={ticker} />}
      <RefreshQuoteButton ticker={ticker} />
    </>
  )
}

test('late A response stays in A cache after rerender to B', async () => {
  const a = deferred<QuoteOut>()
  const b = deferred<QuoteOut>()
  vi.mocked(refreshQuote).mockImplementation((ticker) => (ticker === 'AAA' ? a.promise : b.promise))
  const client = quoteClient()
  const { rerender } = render(withClient(client, <AutoQuoteHarness ticker="AAA" />))
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledWith('AAA'))

  rerender(withClient(client, <AutoQuoteHarness ticker="BBB" />))
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledWith('BBB'))
  await act(async () => b.resolve(quote('BBB', 200, AT_1001)))
  await act(async () => a.resolve(quote('AAA', 10, AT_1000)))

  expect(client.getQueryData(['quote', 'BBB'])).toMatchObject({ ticker: 'BBB', price: 200 })
  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ ticker: 'AAA', price: 10 })
})

test('older same-ticker quote loses', async () => {
  const first = deferred<QuoteOut>()
  const second = deferred<QuoteOut>()
  vi.mocked(refreshQuote).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const client = quoteClient()
  render(withClient(client, <RefreshQuoteHarness ticker="AAA" />))

  fireEvent.click(screen.getByRole('button', { name: 'Refresh quote' }))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh quote' }))
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledTimes(2))
  await act(async () => second.resolve(quote('AAA', 11, AT_1001)))
  await act(async () => first.resolve(quote('AAA', 10, AT_1000)))

  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 11 })
})

test('stale GET cannot overwrite refresh', async () => {
  const read = deferred<QuoteOut>()
  let readSignal: AbortSignal | undefined
  vi.mocked(getQuote).mockImplementation((_ticker, signal) => {
    readSignal = signal
    return read.promise
  })
  vi.mocked(refreshQuote).mockResolvedValue(quote('AAA', 110, AT_1001))
  const client = quoteClient()
  render(withClient(client, <RefreshQuoteHarness ticker="AAA" read />))
  await waitFor(() => expect(getQuote).toHaveBeenCalledWith('AAA', expect.anything()))

  fireEvent.click(screen.getByRole('button', { name: 'Refresh quote' }))
  await waitFor(() => expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 110 }))
  await act(async () => read.resolve(quote('AAA', 100, AT_1000)))

  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 110 })
  expect(readSignal?.aborted).toBe(true)
})

test.each([
  ['read first, timed', true, AT_1000],
  ['refresh first, timed', false, AT_1000],
  ['read first, untimed', true, null],
  ['refresh first, untimed', false, null],
] as const)('cancelled simultaneous GET does not discard a refresh: %s', async (_name, readFirst, time) => {
  const read = deferred<QuoteOut>()
  const refresh = deferred<QuoteOut>()
  vi.mocked(getQuote).mockReturnValue(read.promise)
  vi.mocked(refreshQuote).mockReturnValue(refresh.promise)
  const client = quoteClient()
  client.setQueryData(['quote', 'AAA'], quote('AAA', 1, time))
  const { rerender } = render(withClient(client, <RefreshQuoteHarness ticker="AAA" />))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh quote' }))
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledTimes(1))
  rerender(withClient(client, <RefreshQuoteHarness ticker="AAA" read />))
  await waitFor(() => expect(getQuote).toHaveBeenCalledTimes(1))

  await act(async () => {
    if (readFirst) {
      read.resolve(quote('AAA', 3, time))
      refresh.resolve(quote('AAA', 2, time))
    } else {
      refresh.resolve(quote('AAA', 2, time))
      read.resolve(quote('AAA', 3, time))
    }
  })

  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 2 })
})

test('a completed later GET wins an equal-time tie against an earlier refresh', async () => {
  const read = deferred<QuoteOut>()
  const refresh = deferred<QuoteOut>()
  vi.mocked(getQuote).mockReturnValue(read.promise)
  vi.mocked(refreshQuote).mockReturnValue(refresh.promise)
  const client = quoteClient()
  client.setQueryData(['quote', 'AAA'], quote('AAA', 1, AT_1000))
  const { rerender } = render(withClient(client, <RefreshQuoteHarness ticker="AAA" />))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh quote' }))
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledTimes(1))
  rerender(withClient(client, <RefreshQuoteHarness ticker="AAA" read />))
  await waitFor(() => expect(getQuote).toHaveBeenCalledTimes(1))
  await act(async () => read.resolve(quote('AAA', 3, AT_1000)))
  await waitFor(() => expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 3 }))

  await act(async () => refresh.resolve(quote('AAA', 2, AT_1000)))

  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 3 })
})

test('a cancelled newer GET does not let an older refresh replace a committed quote', async () => {
  const older = deferred<QuoteOut>()
  const newer = deferred<QuoteOut>()
  const read = deferred<QuoteOut>()
  vi.mocked(refreshQuote).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
  vi.mocked(getQuote).mockReturnValue(read.promise)
  const client = quoteClient()
  client.setQueryData(['quote', 'AAA'], quote('AAA', 1, AT_1000))
  const { rerender } = render(withClient(client, <RefreshQuoteHarness ticker="AAA" />))
  const button = screen.getByRole('button', { name: 'Refresh quote' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledTimes(2))
  await act(async () => newer.resolve(quote('AAA', 3, AT_1000)))
  await waitFor(() => expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 3 }))
  rerender(withClient(client, <RefreshQuoteHarness ticker="AAA" read />))
  await waitFor(() => expect(getQuote).toHaveBeenCalledTimes(1))

  await act(async () => {
    read.resolve(quote('AAA', 4, AT_1000))
    older.resolve(quote('AAA', 2, AT_1000))
  })

  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 3 })
})

test('a later GET with an older observation keeps the newer cached quote', async () => {
  vi.mocked(getQuote).mockResolvedValue(quote('AAA', 100, AT_1000))
  const client = quoteClient()
  client.setQueryData(['quote', 'AAA'], quote('AAA', 110, AT_1001))
  render(withClient(client, <QuoteReader ticker="AAA" />))

  await waitFor(() => expect(getQuote).toHaveBeenCalled())
  await waitFor(() => expect(client.getQueryState(['quote', 'AAA'])?.fetchStatus).toBe('idle'))
  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 110 })
})

test('a quote naming another ticker never enters either cache', async () => {
  vi.mocked(refreshQuote).mockResolvedValue(quote('BBB', 200, AT_1001))
  vi.mocked(getQuote).mockResolvedValue(quote('BBB', 200, AT_1001))
  const client = quoteClient()
  const bbb = quote('BBB', 150, AT_1000)
  client.setQueryData(['quote', 'BBB'], bbb)
  render(withClient(client, <RefreshQuoteHarness ticker="AAA" read />))

  fireEvent.click(screen.getByRole('button', { name: 'Refresh quote' }))
  await waitFor(() => expect(client.getQueryState(['quote', 'AAA'])?.status).toBe('error'))
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledWith('AAA'))
  await act(async () => {})

  expect(client.getQueryData(['quote', 'AAA'])).toBeUndefined()
  expect(client.getQueryData(['quote', 'BBB'])).toBe(bbb)
})

test('an untimed refresh cannot replace a timed quote; the later request wins an untimed tie', async () => {
  const client = quoteClient()
  render(withClient(client, <RefreshQuoteHarness ticker="AAA" />))
  const button = screen.getByRole('button', { name: 'Refresh quote' })

  client.setQueryData(['quote', 'AAA'], quote('AAA', 10, AT_1000))
  vi.mocked(refreshQuote).mockResolvedValueOnce(quote('AAA', 99, null))
  fireEvent.click(button)
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledTimes(1))
  await act(async () => {})
  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 10 })

  client.setQueryData(['quote', 'AAA'], quote('AAA', 1, null))
  const first = deferred<QuoteOut>()
  const second = deferred<QuoteOut>()
  vi.mocked(refreshQuote).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledTimes(3))
  await act(async () => second.resolve(quote('AAA', 3, null)))
  await act(async () => first.resolve(quote('AAA', 2, null)))
  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ price: 3 })
})

test('StrictMode starts one automatic refresh per visit', async () => {
  vi.mocked(refreshQuote).mockReturnValue(new Promise(() => {}))
  render(<StrictMode>{withClient(quoteClient(), <AutoQuoteHarness ticker="AAA" />)}</StrictMode>)

  await waitFor(() => expect(refreshQuote).toHaveBeenCalledWith('AAA'))
  await act(async () => {})
  expect(refreshQuote).toHaveBeenCalledTimes(1)
})

test('A to B to A keeps each quote in its own ticker and waits for the pending A request', async () => {
  const a = deferred<QuoteOut>()
  const b = deferred<QuoteOut>()
  vi.mocked(refreshQuote).mockImplementation((ticker) => (ticker === 'AAA' ? a.promise : b.promise))
  const client = quoteClient()
  const { rerender } = render(withClient(client, <AutoQuoteHarness ticker="AAA" />))
  rerender(withClient(client, <AutoQuoteHarness ticker="BBB" />))
  rerender(withClient(client, <AutoQuoteHarness ticker="AAA" />))
  await act(async () => {})

  await act(async () => b.resolve(quote('BBB', 200, AT_1001)))
  await act(async () => a.resolve(quote('AAA', 10, AT_1000)))

  expect(vi.mocked(refreshQuote).mock.calls).toEqual([['AAA'], ['BBB']])
  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ ticker: 'AAA', price: 10 })
  expect(client.getQueryData(['quote', 'BBB'])).toMatchObject({ ticker: 'BBB', price: 200 })
})

test('automatic refresh skips an interval while the previous request is pending', async () => {
  vi.useFakeTimers()
  try {
    const first = deferred<QuoteOut>()
    vi.mocked(refreshQuote).mockReturnValueOnce(first.promise).mockReturnValue(new Promise(() => {}))
    const { unmount } = render(withClient(quoteClient(), <AutoQuoteHarness ticker="AAA" />))
    await act(async () => {})
    expect(refreshQuote).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(refreshQuote).toHaveBeenCalledTimes(1)

    await act(async () => { first.resolve(quote('AAA', 10, AT_1000)) })
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(refreshQuote).toHaveBeenCalledTimes(2)

    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(refreshQuote).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

test('a failed refresh keeps the cached quote', async () => {
  vi.mocked(refreshQuote).mockRejectedValue(new Error('Yahoo unavailable'))
  const client = quoteClient()
  const cached = quote('AAA', 10, AT_1000)
  client.setQueryData(['quote', 'AAA'], cached)
  render(withClient(client, <AutoQuoteHarness ticker="AAA" />))

  await waitFor(() => expect(refreshQuote).toHaveBeenCalledWith('AAA'))
  await act(async () => {})
  expect(client.getQueryData(['quote', 'AAA'])).toBe(cached)
})

test('a refresh completing after unmount still lands in its own ticker', async () => {
  const a = deferred<QuoteOut>()
  vi.mocked(refreshQuote).mockReturnValue(a.promise)
  const client = quoteClient()
  const { unmount } = render(withClient(client, <AutoQuoteHarness ticker="AAA" />))
  await waitFor(() => expect(refreshQuote).toHaveBeenCalledWith('AAA'))

  unmount()
  await act(async () => a.resolve(quote('AAA', 10, AT_1000)))

  expect(client.getQueryData(['quote', 'AAA'])).toMatchObject({ ticker: 'AAA', price: 10 })
})

function aiReport(ticker: string, summary: string, generatedAt: string): AiResearchOut {
  return {
    snapshot_id: 1,
    ticker,
    score: 60,
    confidence: 70,
    lean: 'neutral',
    summary,
    key_drivers: [],
    risks: [],
    price_reference: null,
    inputs_used: {
      news_item_ids: [],
      news_item_count: 0,
      twitter_post_ids: [],
      twitter_post_count: 0,
      twitter_cache_is_fresh: false,
      twitter_cache_age_seconds: null,
      reddit_post_ids: [],
      reddit_post_count: 0,
      reddit_cache_is_fresh: false,
      reddit_cache_age_seconds: null,
      quant_facts: [],
    },
    caveat: 'Informational only.',
    source: { ok: true, error: null },
    generated_at: generatedAt,
    cached: false,
    current_price: 100,
    usage: null,
  }
}

function AiRefreshButton({ ticker }: { ticker: string }) {
  const refresh = useRefreshAiResearch(ticker)
  return <button onClick={() => refresh.mutate()}>Refresh AI</button>
}

function AiReadAndRefresh({ ticker }: { ticker: string }) {
  useAiResearch(ticker, true)
  return <AiRefreshButton ticker={ticker} />
}

test('late old AI report loses', async () => {
  const read = deferred<AiResearchOut>()
  vi.mocked(getAiResearch).mockReturnValue(read.promise)
  vi.mocked(refreshAiResearch).mockResolvedValue(aiReport('AAA', 'new', '2026-10-23T14:05:00Z'))
  const client = quoteClient()
  render(withClient(client, <AiReadAndRefresh ticker="AAA" />))
  await waitFor(() => expect(getAiResearch).toHaveBeenCalledWith('AAA'))

  fireEvent.click(screen.getByRole('button', { name: 'Refresh AI' }))
  await waitFor(() => expect(client.getQueryData(['ai-research', 'AAA'])).toMatchObject({ summary: 'new' }))
  await act(async () => read.resolve(aiReport('AAA', 'old', '2026-10-23T14:00:00Z')))

  expect(client.getQueryData(['ai-research', 'AAA'])).toMatchObject({ summary: 'new' })
})

test('a refresh publishes only reports newer than the cached one, to the microsecond', async () => {
  const client = quoteClient()
  client.setQueryData(['ai-research', 'AAA'], aiReport('AAA', 'cached', '2026-10-23T14:00:00.123456Z'))
  vi.mocked(refreshAiResearch)
    .mockResolvedValueOnce(aiReport('AAA', 'newer', '2026-10-23T14:00:00.123999Z'))
    .mockResolvedValueOnce(aiReport('AAA', 'older', '2026-10-23T14:00:00.123500Z'))
  render(withClient(client, <AiRefreshButton ticker="AAA" />))

  fireEvent.click(screen.getByRole('button', { name: 'Refresh AI' }))
  await waitFor(() => expect(client.getQueryData(['ai-research', 'AAA'])).toMatchObject({ summary: 'newer' }))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh AI' }))
  await waitFor(() => expect(refreshAiResearch).toHaveBeenCalledTimes(2))
  await act(async () => {})

  expect(client.getQueryData(['ai-research', 'AAA'])).toMatchObject({ summary: 'newer' })
})
