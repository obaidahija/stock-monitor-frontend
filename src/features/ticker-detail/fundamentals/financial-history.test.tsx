import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { FinancialHistory } from './financial-history'
import { history, metric, source } from './test-fixtures'

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json(history()))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('reads the full retained quarterly window without reusing the eight-period cache', async () => {
  const periods = Array.from({ length: 22 }, (_, index) => {
    const end = new Date(Date.UTC(2026, 6 - index * 3, 0))
    return {
      period_start: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1)).toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      fiscal_label: `FY${end.getUTCFullYear()} Q${Math.floor(end.getUTCMonth() / 3) + 1}`,
      period_type: 'quarterly' as const,
      metrics: { revenue: metric('100') },
    }
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  queryClient.setQueryData(['sec-fundamentals', 'NVDA', 'quarterly', 8], history({ periods: periods.slice(0, 8) }))
  fetchMock.mockImplementation(async (url: string) => {
    const limit = Number(new URL(url, 'http://localhost').searchParams.get('limit'))
    return Response.json(history({ periods: periods.slice(0, limit) }))
  })

  render(<QueryClientProvider client={queryClient}><FinancialHistory ticker="NVDA" /></QueryClientProvider>)
  await screen.findByText('Figures and source filings')
  fireEvent.click(screen.getByText('Figures and source filings'))

  expect(await screen.findByRole('columnheader', { name: /FY2021 Q1/ })).toBeVisible()
  expect(screen.getByRole('columnheader', { name: /FY2026 Q2/ })).toBeVisible()
  expect(screen.getAllByRole('columnheader')).toHaveLength(23)
  expect(screen.getAllByRole('link', { name: /10-Q · filed/, hidden: true })).toHaveLength(22)
  expect(queryClient.getQueryData(['sec-fundamentals', 'NVDA', 'quarterly', 24])).toMatchObject({ periods })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith('/v1/stocks/NVDA/fundamentals?period=quarterly&limit=24', expect.objectContaining({ headers: expect.any(Headers) }))
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true)
})

test('mount and retry loading only read cached history, with zero distinct from unavailable', async () => {
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  expect((await screen.findAllByText('$0.00'))[0]).toBeVisible()
  expect(screen.getAllByText('$9,007,199,254,740,993.12')[0]).toBeInTheDocument()
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
  expect(fetchMock).toHaveBeenCalledWith('/v1/stocks/NVDA/fundamentals?period=quarterly&limit=24', expect.objectContaining({ headers: expect.any(Headers) }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Context for research/)).toBeInTheDocument()
  expect(screen.getByText(/Reporting age/)).toBeInTheDocument()
  expect(screen.getByText(/Last checked/)).toBeInTheDocument()
})

test('discloses metric basis, exact decimals, dates and filing evidence', async () => {
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  await screen.findAllByText('$0.00')
  fireEvent.click(screen.getByText('Figures and source filings'))
  expect(screen.getByText('12.3456%')).toBeVisible()
  expect(screen.getAllByText('Calculated').length).toBeGreaterThan(0)
  expect(screen.getByText('Mixed filings')).toBeVisible()
  expect(screen.getAllByText('Later disclosure')[0]).toBeVisible()
  fireEvent.click(screen.getAllByText('Sources and calculation')[0])
  expect(screen.getAllByRole('link', { name: /10-Q · filed 2026-08-05/ })[0]).toHaveAttribute('href', source.source_url)
  expect(screen.getAllByText(/Available 2026-08-05T16:00:00Z/).length).toBeGreaterThan(0)
})

test('annual selection reads annual cache and navigation never shows the former ticker history', async () => {
  const user = userEvent.setup()
  const view = renderWithProviders(<FinancialHistory ticker="NVDA" />)
  await screen.findAllByText('$0.00')
  fetchMock.mockResolvedValueOnce(Response.json(history({ period: 'annual', periods: [] })))
  await user.click(screen.getByRole('combobox', { name: 'Financial reporting period' }))
  await user.click(screen.getByRole('option', { name: 'Annual' }))
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/v1/stocks/NVDA/fundamentals?period=annual&limit=24', expect.objectContaining({ headers: expect.any(Headers) })))
  fetchMock.mockImplementationOnce(() => new Promise(() => {}))
  view.rerender(<FinancialHistory ticker="MSFT" />)
  expect(screen.queryByText('$9,007,199,254,740,993.12')).not.toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/v1/stocks/MSFT/fundamentals?period=quarterly&limit=24', expect.objectContaining({ headers: expect.any(Headers) })))
})

test.each(['unsupported', 'empty', 'unavailable'] as const)('explains %s coverage and disables refresh when collection is paused', async (status) => {
  fetchMock.mockResolvedValue(Response.json(history({ periods: [], collection_enabled: false, quality: { status, reasons: ['unsupported_form'] } })))
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  expect(await screen.findByText('Unsupported form')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh financial history' })).toBeDisabled()
  expect(screen.getByText(/Collection is disabled/)).toBeInTheDocument()
})

test('a failed cached read offers a read-only retry', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ detail: 'History read failed' }, { status: 500 }))
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  expect(await screen.findByText('History read failed')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading financial history' }))
  expect((await screen.findAllByText('$0.00'))[0]).toBeVisible()
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true)
})

test('explicit refresh polls stored status and retains prior figures after failure', async () => {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json({ ticker: 'NVDA', cik: '0000000123', request_id: 'r1', state: 'queued' }, { status: 202 })
    if (url.endsWith('/refresh/r1')) return Response.json({ ticker: 'NVDA', cik: '0000000123', request_id: 'r1', state: 'failed', error: 'SEC temporarily unavailable', snapshot_id: null })
    return Response.json(history())
  })
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  await screen.findAllByText('$0.00')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh financial history' }))
  expect(screen.getAllByText('$0.00')[0]).toBeVisible()
  expect(await screen.findByText(/SEC temporarily unavailable/)).toBeInTheDocument()
  expect(screen.getAllByText('$0.00')[0]).toBeVisible()
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test('a pending-companyfacts failure reloads pending accessions while retaining saved figures', async () => {
  let failed = false
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const request = { ticker: 'NVDA', cik: '0000000123', request_id: 'pending', requested_at: '2026-11-02T12:00:00Z', snapshot_id: 7, error: null }
    if (init?.method === 'POST') return Response.json({ ...request, state: 'queued' }, { status: 202 })
    if (url.endsWith('/refresh/pending')) {
      failed = true
      return Response.json({ ...request, state: 'failed', error: 'pending_companyfacts' })
    }
    return Response.json(history({
      pending_filings: failed ? ['new-accession'] : [],
      checked_at: failed ? '2026-11-02T12:01:00Z' : '2026-10-28T12:00:00Z',
      ...(failed ? { refresh: { ...request, state: 'failed', error: 'pending_companyfacts' } } : {}),
    }))
  })
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  await screen.findAllByText('$0.00')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh financial history' }))
  expect(await screen.findByText(/Pending SEC financial facts for filing\(s\): new-accession/)).toBeInTheDocument()
  expect(screen.getAllByText('$0.00')[0]).toBeVisible()
  expect(screen.getByText(/pending_companyfacts/)).toBeInTheDocument()
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test('an in-flight refresh belongs to its ticker even when navigation occurs before POST resolves', async () => {
  let finishRefresh: (response: Response) => void = () => {}
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Promise<Response>((resolve) => { finishRefresh = resolve })
    if (url.includes('/MSFT/')) return Response.json(history({ ticker: 'MSFT', periods: [] }))
    if (url.endsWith('/refresh/r1')) return Response.json({ ticker: 'NVDA', cik: '0000000123', request_id: 'r1', state: 'completed', error: null, snapshot_id: 8 })
    return Response.json(history())
  })
  const view = renderWithProviders(<FinancialHistory ticker="NVDA" />)
  await screen.findAllByText('$0.00')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh financial history' }))
  view.rerender(<FinancialHistory ticker="MSFT" />)
  finishRefresh(Response.json({ ticker: 'NVDA', cik: '0000000123', request_id: 'r1', state: 'queued' }))
  await screen.findByText('No saved financial history for this reporting period.')
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url]) => url === '/v1/stocks/MSFT/fundamentals/refresh/r1')).toBe(false)
})

test('a status-read failure can be retried without submitting another refresh', async () => {
  let statusReads = 0
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json({ ticker: 'NVDA', cik: '0000000123', request_id: 'r2', state: 'queued' })
    if (url.endsWith('/refresh/r2')) {
      statusReads++
      return statusReads === 1
        ? Response.json({ detail: 'Status temporarily unavailable' }, { status: 503 })
        : Response.json({ ticker: 'NVDA', cik: '0000000123', request_id: 'r2', state: 'completed', error: null, snapshot_id: 7 })
    }
    return Response.json(history())
  })
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  await screen.findAllByText('$0.00')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh financial history' }))
  await screen.findByText(/Status temporarily unavailable/)
  fireEvent.click(screen.getByRole('button', { name: 'Retry refresh status' }))
  expect(await screen.findByText('Financial history refresh completed.')).toBeInTheDocument()
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test.each([
  { status: 'unavailable', reasons: ['retained_last_known'] },
  { status: 'partial', reasons: ['coverage_regression'] },
] as const)('retained history is explicitly last-known for $status/$reasons', async ({ status, reasons }) => {
  fetchMock.mockResolvedValue(Response.json(history({ quality: { status, reasons: [...reasons] } })))
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  expect(await screen.findByText(/Showing last-known financial history/)).toBeInTheDocument()
  expect(screen.getAllByText('$0.00')[0]).toBeVisible()
})

test('queued and running stored requests poll until completion and then read the new saved snapshot', async () => {
  let statusReads = 0
  let complete = false
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/refresh/existing')) {
      statusReads++
      complete = statusReads > 1
      return Response.json({ ticker: 'NVDA', cik: '0000000123', request_id: 'existing', state: complete ? 'completed' : 'running', error: null, snapshot_id: complete ? 8 : null })
    }
    return Response.json(history({ snapshot_id: complete ? 8 : 7, refresh: { request_id: 'existing', state: complete ? 'completed' : 'queued', error: null, snapshot_id: complete ? 8 : null } }))
  })
  renderWithProviders(<FinancialHistory ticker="NVDA" />)
  expect(await screen.findByText(/Financial history refresh running/)).toBeInTheDocument()
  expect(screen.getAllByText('$0.00')[0]).toBeVisible()
  expect(await screen.findByText(/Snapshot 8 · publication 9/, {}, { timeout: 4000 })).toBeInTheDocument()
  await new Promise((resolve) => setTimeout(resolve, 2200))
  expect(statusReads).toBe(2)
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true)
}, 6500)
