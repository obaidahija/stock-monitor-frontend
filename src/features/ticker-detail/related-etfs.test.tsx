import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getRelatedEtfDescription, getRelatedEtfs, refreshRelatedEtfQuotes, getRelatedEtfRelevance, refreshRelatedEtfRelevance } from '@/api/stocks'
import { renderWithProviders } from '@/test/render'
import type { QuoteOut, RelatedEtfsOut, RelatedEtfRelevanceOut } from '@/types/api'
import { regularTradingDate, relativeGap } from './related-etf-math'
import { RelatedEtfs } from './related-etfs'

vi.mock('@/api/stocks', () => ({ getRelatedEtfDescription: vi.fn(), getRelatedEtfs: vi.fn(), refreshRelatedEtfQuotes: vi.fn(), getRelatedEtfRelevance: vi.fn(), refreshRelatedEtfRelevance: vi.fn() }))
vi.mock('@/features/ticker-detail/hooks', () => ({ useQuote: () => ({ data: quote('UEC', 4) }) }))

function quote(ticker: string, pct: number | null, time = '2026-10-08T20:00:00Z'): QuoteOut {
  return {
    ticker, price: 40, change_pct: pct, change_amount: null,
    regular_market_time: time, market_session: 'closed', session_price: 40,
    session_change_amount: null, session_change_pct: pct, session_time: time,
  }
}

function payload(ticker = 'UEC'): RelatedEtfsOut {
  return {
    ticker, status: 'available', stale: false, fetched_at: '2026-10-09T12:00:00Z',
    total_count: 79, attribution_name: 'TickerInside',
    attribution_url: `https://tickerinside.com/api/v1/sec/${ticker.toLowerCase()}.json`,
    items: Array.from({ length: 20 }, (_, i) => ({
      ticker: i === 0 ? 'URA' : `ETF${i}`, name: i === 0 ? 'Global X Uranium ETF' : `Fund ${i}`,
      weight_pct: 4.65 - i / 10, holdings_date: '2026-10-08', source: 'issuer' as const,
      quote: quote(i === 0 ? 'URA' : `ETF${i}`, i === 0 ? 1.5 : i === 1 ? -2 : 0),
    })),
  }
}

function fit(ticker = 'UEC', status: RelatedEtfRelevanceOut['status'] = 'ready'): RelatedEtfRelevanceOut {
  return {
    ticker, status, model: 'classifier:local', rubric_version: 'business-fit-v1', fetched_at: '2026-10-09T12:00:00Z',
    items: [{ ticker: 'URA', score: 81, business_score: 90, weight_pct: 4.65, concentration_score: 46.5, category: 'direct', explanation: 'Explicit uranium industry focus.', evidence: 'Uranium', stale: false }],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRelatedEtfs).mockImplementation(async (ticker) => payload(ticker))
  vi.mocked(refreshRelatedEtfQuotes).mockResolvedValue([])
  vi.mocked(refreshRelatedEtfRelevance).mockImplementation(async (ticker) => fit(ticker))
  vi.mocked(getRelatedEtfRelevance).mockImplementation(async (ticker) => fit(ticker))
  vi.mocked(getRelatedEtfDescription).mockResolvedValue({
    ticker: 'URA', description: 'The fund invests in uranium and nuclear energy companies.',
    fetched_at: '2026-10-09T12:00:00Z', stale: false, source_name: 'Yahoo Finance',
    source_url: 'https://finance.yahoo.com/quote/URA/profile/',
  })
})

afterEach(() => { cleanup(); vi.useRealTimers() })

test('shows five visible cards, directions, gap, weight, dates, and attribution', async () => {
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const ura = await screen.findByRole('article', { name: 'URA related ETF' })
  expect(screen.getAllByRole('article')).toHaveLength(5)
  expect(within(ura).getByText('+1.50%')).toBeInTheDocument()
  expect(within(ura).getByText('UEC ahead by 2.50 pp')).toBeInTheDocument()
  expect(within(ura).getAllByText('4.65%')[0]).toBeInTheDocument()
  expect(within(ura).getByText('UEC weight')).toBeInTheDocument()
  expect(within(ura).getByText('Regular session · Oct 8, 2026')).toBeInTheDocument()
  expect(screen.getByText('-2.00%')).toBeInTheDocument()
  expect(screen.getAllByText('0.00%')).toHaveLength(3)
  expect(screen.getByRole('link', { name: 'TickerInside' })).toHaveAttribute('href', payload().attribution_url)
  fireEvent.click(within(ura).getByText('Holdings · Oct 8, 2026'))
  expect(within(ura).getByText(/Issuer-reported holdings/)).toBeInTheDocument()
})

test('expands to twenty and resets expansion when ticker changes', async () => {
  const view = renderWithProviders(<RelatedEtfs ticker="UEC" />)
  await screen.findByRole('article', { name: 'URA related ETF' })
  fireEvent.click(screen.getByRole('button', { name: 'Show more (20)' }))
  expect(screen.getAllByRole('article')).toHaveLength(20)
  expect(screen.getByRole('link', { name: 'All 79 reported holders' })).toBeInTheDocument()
  view.rerender(<RelatedEtfs ticker="LEU" />)
  await screen.findByText('ETFs holding LEU, ranked by stock weight')
  await screen.findByRole('article', { name: 'URA related ETF' })
  expect(screen.getAllByRole('article')).toHaveLength(5)
})

test('missing quotes and mismatched dates never produce a misleading gap', async () => {
  const data = payload()
  data.items[0].quote = quote('URA', null)
  data.items[1].quote = quote('ETF1', 2, '2026-10-07T20:00:00Z')
  vi.mocked(getRelatedEtfs).mockResolvedValue(data)
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const ura = await screen.findByRole('article', { name: 'URA related ETF' })
  expect(within(ura).getByText('Quote unavailable')).toBeInTheDocument()
  expect(screen.getAllByText('Comparison unavailable')).toHaveLength(2)
})

test.each(['unavailable', 'empty'] as const)('handles %s coverage separately', async (status) => {
  vi.mocked(getRelatedEtfs).mockResolvedValue({ ...payload(), status, items: [], total_count: 0 })
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  expect(await screen.findByText(status === 'unavailable'
    ? 'ETF holdings coverage is currently unavailable.'
    : 'No ETF holders found in the provider’s covered data.')).toBeInTheDocument()
  expect(refreshRelatedEtfQuotes).not.toHaveBeenCalled()
})

test('displays cached holdings and SEC provenance explicitly', async () => {
  const data = payload()
  data.stale = true
  data.items[0].source = 'sec_nport'
  vi.mocked(getRelatedEtfs).mockResolvedValue(data)
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  await screen.findByRole('article', { name: 'URA related ETF' })
  expect(screen.getByText(/Using cached holdings/)).toBeInTheDocument()
  expect(screen.getByText(/SEC Form N-PORT filing/)).toBeInTheDocument()
})

describe('quote polling', () => {
  async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(1) }) }

  test('batches visible symbols, prevents overlap, pauses when hidden, and cleans up', async () => {
    vi.useFakeTimers()
    let resolve: (value: QuoteOut[]) => void = () => {}
    vi.mocked(refreshRelatedEtfQuotes).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const view = renderWithProviders(<RelatedEtfs ticker="UEC" />)
    await flush()
    await flush()
    expect(refreshRelatedEtfQuotes).toHaveBeenCalledWith('UEC', ['URA', 'ETF1', 'ETF2', 'ETF3', 'ETF4'])
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(refreshRelatedEtfQuotes).toHaveBeenCalledTimes(1)
    await act(async () => { resolve([quote('URA', -1)]); await Promise.resolve() })
    await flush()
    expect(screen.getByText('-1.00%')).toBeInTheDocument()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(refreshRelatedEtfQuotes).toHaveBeenCalledTimes(1)
    visibility.mockReturnValue('visible')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(refreshRelatedEtfQuotes).toHaveBeenCalledTimes(2)
    view.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(refreshRelatedEtfQuotes).toHaveBeenCalledTimes(2)
    visibility.mockRestore()
  })

  test('old pending response cannot update the next ticker', async () => {
    vi.useFakeTimers()
    let resolve: (value: QuoteOut[]) => void = () => {}
    vi.mocked(refreshRelatedEtfQuotes).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const view = renderWithProviders(<RelatedEtfs ticker="UEC" />)
    await flush(); await flush()
    view.rerender(<RelatedEtfs ticker="LEU" />)
    await flush(); await flush()
    await act(async () => { resolve([quote('URA', 99)]); await Promise.resolve() })
    await flush()
    expect(screen.queryByText('+99.00%')).not.toBeInTheDocument()
    expect(refreshRelatedEtfQuotes).toHaveBeenLastCalledWith('LEU', ['URA', 'ETF1', 'ETF2', 'ETF3', 'ETF4'])
  })
})

test('relative gap uses the Eastern trading date and handles null and flat values', () => {
  expect(regularTradingDate('2026-10-09T00:30:00Z')).toBe('2026-10-08')
  expect(regularTradingDate('bad')).toBeNull()
  expect(relativeGap(quote('UEC', 4), quote('URA', 1.5))).toBe(2.5)
  expect(relativeGap(quote('UEC', 0), quote('URA', 0))).toBe(0)
  expect(relativeGap(quote('UEC', -4), quote('URA', -1))).toBe(-3)
  expect(relativeGap(quote('UEC', 4), quote('URA', 1, '2026-10-07T20:00:00Z'))).toBeNull()
  expect(relativeGap(undefined, quote('URA', 1))).toBeNull()
})

test('loads descriptions only on expansion and keeps them collapsed initially', async () => {
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const ura = await screen.findByRole('article', { name: 'URA related ETF' })
  const button = within(ura).getByRole('button', { name: 'About this ETF' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(getRelatedEtfDescription).not.toHaveBeenCalled()
  fireEvent.click(button)
  expect(await within(ura).findByText('The fund invests in uranium and nuclear energy companies.')).toBeVisible()
  expect(getRelatedEtfDescription).toHaveBeenCalledWith('UEC', 'URA')
  expect(within(ura).getByRole('link', { name: 'Yahoo Finance' })).toHaveAttribute('href', 'https://finance.yahoo.com/quote/URA/profile/')
  fireEvent.click(button)
  expect(within(ura).getByText('The fund invests in uranium and nuclear energy companies.')).not.toBeVisible()
  fireEvent.click(button)
  expect(getRelatedEtfDescription).toHaveBeenCalledTimes(1)
})

test('omits About this ETF when no description is available', async () => {
  vi.mocked(getRelatedEtfDescription).mockResolvedValue({
    ticker: 'URA', description: null, fetched_at: '2026-10-09T12:00:00Z', stale: false,
    source_name: 'Yahoo Finance', source_url: 'https://finance.yahoo.com/quote/URA/profile/',
  })
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const ura = await screen.findByRole('article', { name: 'URA related ETF' })
  fireEvent.click(within(ura).getByRole('button', { name: 'About this ETF' }))
  await waitFor(() => {
    expect(within(ura).queryByRole('button', { name: 'About this ETF' })).not.toBeInTheDocument()
  })
})

test('description failures do not affect the ETF quote or weight', async () => {
  vi.mocked(getRelatedEtfDescription).mockRejectedValue(new Error('offline'))
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const ura = await screen.findByRole('article', { name: 'URA related ETF' })
  fireEvent.click(within(ura).getByRole('button', { name: 'About this ETF' }))
  expect(await within(ura).findByText('Description temporarily unavailable.')).toBeVisible()
  expect(within(ura).getByText('+1.50%')).toBeInTheDocument()
  expect(within(ura).getAllByText('4.65%')[0]).toBeInTheDocument()
})


test('shows estimated business fit separately from stock weight with explanation in details', async () => {
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const score = await screen.findByText('81%')
  const card = screen.getByRole('article', { name: 'URA related ETF' })
  expect(score).toBeInTheDocument()
  expect(within(card).getAllByText('4.65%')[0]).toBeInTheDocument()
  expect(within(card).getByText(/Classifier \+ weight/)).toBeInTheDocument()
  expect(within(card).getByText('Direct industry or theme')).toBeInTheDocument()
  expect(within(card).getByText('Explicit uranium industry focus.')).toBeInTheDocument()
  expect(within(card).getByText(/not a probability/)).toBeInTheDocument()
  expect(refreshRelatedEtfRelevance).toHaveBeenCalledTimes(1)
  expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('URA related ETF')
})

test('unknown and unavailable scores are not rendered as zero', async () => {
  vi.mocked(refreshRelatedEtfRelevance).mockResolvedValue({ ...fit('UEC', 'unavailable'), items: [{
    ticker: 'URA', score: null, category: 'unknown', explanation: 'Insufficient information.', evidence: null, stale: false,
  }] })
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  await screen.findAllByText('Relevance: Unavailable')
  expect(screen.queryByText('0%')).not.toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(5)
})

test('cached business fit is marked without blocking the existing quotes', async () => {
  const response = fit('UEC', 'partial')
  response.items[0].stale = true
  vi.mocked(refreshRelatedEtfRelevance).mockResolvedValue(response)
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  await screen.findByText('81%')
  expect(screen.getByText(/Classifier \+ weight · cached/)).toBeInTheDocument()
  expect(screen.getByText('+1.50%')).toBeInTheDocument()
})

test('relevance failures leave cards and independent quote refresh available', async () => {
  vi.mocked(refreshRelatedEtfRelevance).mockRejectedValue(new Error('offline'))
  renderWithProviders(<RelatedEtfs ticker="UEC" />)
  await screen.findByRole('article', { name: 'URA related ETF' })
  await waitFor(() => expect(screen.getAllByText('Relevance: Unavailable')).toHaveLength(5))
  expect(refreshRelatedEtfQuotes).toHaveBeenCalledTimes(1)
})

test('relevance polls pending results every three seconds only when visible, with no overlap', async () => {
  vi.useFakeTimers()
  vi.mocked(refreshRelatedEtfRelevance).mockResolvedValue({ ...fit('UEC', 'pending'), items: [] })
  vi.mocked(getRelatedEtfRelevance).mockResolvedValue({ ...fit('UEC', 'pending'), items: [] })
  const view = renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(10) }) }
  await flush(); await flush(); await flush()
  expect(refreshRelatedEtfRelevance).toHaveBeenCalledTimes(1)
  expect(screen.getAllByText('Relevance: Assessing…')).toHaveLength(5)
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) }); await flush()
  expect(getRelatedEtfRelevance).toHaveBeenCalledTimes(1)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
  expect(getRelatedEtfRelevance).toHaveBeenCalledTimes(1)
  visibility.mockReturnValue('visible')
  let finish: (value: RelatedEtfRelevanceOut) => void = () => {}
  vi.mocked(getRelatedEtfRelevance).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  await flush()
  await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
  expect(getRelatedEtfRelevance).toHaveBeenCalledTimes(2)
  await act(async () => { finish(fit()); await Promise.resolve() }); await flush()
  expect(screen.getByText('90%')).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
  expect(getRelatedEtfRelevance).toHaveBeenCalledTimes(2)
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(getRelatedEtfRelevance).toHaveBeenCalledTimes(2)
  visibility.mockRestore()
})

test('navigation starts a new assessment and drops polling for the previous ticker', async () => {
  vi.useFakeTimers()
  vi.mocked(refreshRelatedEtfRelevance).mockImplementation(async (ticker) => ({ ...fit(ticker, 'pending'), items: [] }))
  vi.mocked(getRelatedEtfRelevance).mockImplementation(async (ticker) => ({ ...fit(ticker, 'pending'), items: [] }))
  const view = renderWithProviders(<RelatedEtfs ticker="UEC" />)
  const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(10) }) }
  await flush(); await flush(); await flush()
  view.rerender(<RelatedEtfs ticker="DY" />)
  await flush(); await flush(); await flush()
  expect(refreshRelatedEtfRelevance).toHaveBeenCalledWith('DY')
  vi.mocked(getRelatedEtfRelevance).mockClear()
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) }); await flush()
  expect(getRelatedEtfRelevance).toHaveBeenCalledWith('DY')
  expect(getRelatedEtfRelevance).not.toHaveBeenCalledWith('UEC')
})
