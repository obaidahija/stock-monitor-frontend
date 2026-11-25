import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { FilingIntelFilingOut, PricePoint } from '@/types/filing-intel'
import { PriceSteps } from './price-steps'
import { FilingPriceChart } from './price-chart'
import { closeTime, extendedHours, filingIndex, nearestIndex, priceSteps } from './price-chart-model'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Insmed 2026-11-24: $149.09 close, $170.61 pre-market before the 06:04 ET 8-K, $170.15 next close.
const insm = {
  accession: '0001140361-26-045364',
  ticker: 'INSM',
  accepted_at: '2026-11-24T11:04:08Z',
  ref_close: 149.09,
  ref_close_date: '2026-11-23',
  detected_price: 170.61,
  detected_price_session: 'pre',
  detected_price_time: '2026-11-24T11:01:36Z',
  pre_filing_price: 170.61,
  pre_filing_move_pct: 14.43,
  close_1d: 170.15,
  close_1d_date: '2026-11-24',
  close_5d: null,
  close_5d_date: null,
} as unknown as FilingIntelFilingOut

test('steps run from the last close through the filing to now, moves measured before the filing', () => {
  const steps = priceSteps(insm, { ticker: 'INSM', price: 172, session: 'regular', time: '2026-11-25T18:00:00Z' })
  expect(steps.map((s) => s.label)).toEqual(['Prev close', 'At filing', '+1 day', '+5 days', 'Now'])
  expect(steps[1].change).toBeCloseTo(14.43, 1) // the jump before the filing, from the close
  expect(steps[2].change).toBeCloseTo(-0.27, 1) // after it, from the pre-filing price
  expect(steps[3].price).toBeNull()
})

test('a session close is 16:00 New York time in winter and summer', () => {
  expect(closeTime('2026-11-23')).toBe('2026-11-23T21:00:00.000Z')
  expect(closeTime('2026-07-15')).toBe('2026-07-15T20:00:00.000Z')
})

test('markers find their bar, the filing line its first bar after acceptance, and extended hours their runs', () => {
  const points: PricePoint[] = [
    { t: '2026-11-24T10:55:00Z', price: 170, session: 'pre' },
    { t: '2026-11-24T11:05:00Z', price: 170.6, session: 'pre' },
    { t: '2026-11-24T14:30:00Z', price: 171, session: 'regular' },
    { t: '2026-11-24T21:05:00Z', price: 170.2, session: 'post' },
  ]
  expect(filingIndex(points, insm.accepted_at)).toBe(1)
  expect(nearestIndex(points, '2026-11-24T21:00:00Z')).toBe(3)
  expect(nearestIndex(points, '2026-12-30T21:00:00Z')).toBeNull()
  expect(extendedHours(points)).toEqual([{ from: 0, to: 1 }, { from: 3, to: 3 }])
})

test('the chart shows the steps and switches to daily closes on request', async () => {
  const user = userEvent.setup()
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    ticker: 'INSM', interval: '5m', accepted_at: insm.accepted_at,
    points: [
      { t: '2026-11-24T10:55:00Z', price: 170, session: 'pre' },
      { t: '2026-11-24T14:30:00Z', price: 171, session: 'regular' },
    ],
  } as never)
  renderWithProviders(<FilingPriceChart filing={insm} now={undefined} />)
  expect(screen.getByRole('list', { name: 'Price before and after the filing' })).toHaveTextContent('$149.09')
  expect(screen.getByText('+14.4%')).toBeInTheDocument()
  await screen.findByText('5-minute bars, pre-market and after-hours shaded')
  await user.click(screen.getByRole('button', { name: 'Daily' }))
  await waitFor(() => expect(get.mock.calls.some(([url]) => String(url).includes('interval=1d'))).toBe(true))
})

test('a filing not caught live takes the last 5-minute trade before it as its filing price', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    ticker: 'GDRX', interval: '5m', accepted_at: '2026-11-24T21:32:08Z',
    points: [
      { t: '2026-11-24T21:00:00Z', price: 3.0, session: 'regular' },
      { t: '2026-11-24T21:30:00Z', price: 3.01, session: 'post' },
      { t: '2026-11-24T21:35:00Z', price: 3.6, session: 'post' },
    ],
  } as never)
  const gdrx = { ...insm, accession: 'x', ticker: 'GDRX', accepted_at: '2026-11-24T21:32:08Z', ref_close: 3.0,
    detected_price: null, detected_price_time: null, pre_filing_price: null, close_1d: 2.38 } as FilingIntelFilingOut
  renderWithProviders(<FilingPriceChart filing={gdrx} now={undefined} />)
  expect(screen.getByText('not caught live')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('$3.01')).toBeInTheDocument())
})

test('after the filing, moves run from the entry: Agilent at $189.50 and $178.44 now is -5.8%', () => {
  // Agilent 2026-11-24: $176.04 close, $189.50 when the 4:06 PM release was caught.
  const agilent = { ...insm, ref_close: 176.04, detected_price: 189.5, pre_filing_price: null, close_1d: 183.52 } as FilingIntelFilingOut
  const steps = priceSteps(agilent, { ticker: 'A', price: 178.44, session: 'regular', time: null })
  expect(steps[1].change).toBeCloseTo(7.6, 1) // already moved by the time it was public
  expect(steps[2].change).toBeCloseTo(-3.2, 1) // +1 day from the entry
  expect(steps[4].change).toBeCloseTo(-5.8, 1) // now from the entry, not +1.4% from the close
})

test('a row shows the same five cards as the panel, with changes from the price at filing', () => {
  const steps = priceSteps(insm, { ticker: 'INSM', price: 175, session: 'regular', time: null })
  render(<PriceSteps steps={steps} size="row" />)
  const cards = screen.getAllByRole('listitem')
  expect(cards.map((c) => c.textContent?.replace(/\u00a0/g, '').trim())).toEqual([
    'Prev close$149.09',
    'At filing+14.4%$170.61', // the change first and large, the price under it
    '+1d-0.3%$170.15',
    '+5d—not yet',
    'Now+2.6%$175.00',
  ])
})

test('a filing after the close is measured from that day\'s market close', () => {
  // VPG's 424B5 at 5:28 PM ET: the 4:00 PM close from its after-hours quote, until tonight.
  const vpg = { ...insm, accepted_at: '2026-11-25T22:28:00Z', ref_close: 44.1, ref_close_date: '2026-11-25',
    ref_close_provisional: true, detected_price: 44.69, pre_filing_price: null, close_1d: null } as FilingIntelFilingOut
  const [before, atFiling] = priceSteps(vpg, undefined)
  expect(before.label).toBe('Market close')
  expect(before.hint).toMatch(/confirmed tonight/)
  expect(atFiling.change).toBeCloseTo(1.3, 1)
})

test('current prices are asked for in batches the endpoint answers in full', async () => {
  const { renderHook, waitFor: wait } = await import('@testing-library/react')
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
  const { useCurrentPrices, PRICE_BATCH } = await import('./hooks')
  const tickers = Array.from({ length: 450 }, (_, i) => `T${String(i).padStart(3, '0')}`)
  const get = vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
    const asked = decodeURIComponent(String(url).split('tickers=')[1] ?? '').split(',')
    return Promise.resolve(asked.map((t) => ({ ticker: t, price: 1, session: 'regular', time: null })) as never)
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { result } = renderHook(() => useCurrentPrices(tickers), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await wait(() => expect(result.current.data?.size).toBe(450))
  expect(get).toHaveBeenCalledTimes(Math.ceil(450 / PRICE_BATCH))
  expect(result.current.data?.get('T449')?.price).toBe(1)
})
