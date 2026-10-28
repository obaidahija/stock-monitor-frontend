import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { AppLayout } from './app-layout'

vi.mock('./ticker-search', () => ({ TickerSearch: () => null }))

const snapshot = {
  captured_at: '2026-10-28T14:00:00Z',
  assets: [
    { symbol: 'GC=F', name: 'Gold', price: 4061.1, daily_change_pct: -0.33132085, quoted_at: '2026-10-28T13:50:00Z', status: 'ok' },
    { symbol: 'BTC-USD', name: 'Bitcoin', price: 80628.04, daily_change_pct: 0.90243655, quoted_at: '2026-10-28T13:59:00Z', status: 'ok' },
    { symbol: 'CL=F', name: 'Crude oil', price: 101.91, daily_change_pct: 2.0120142, quoted_at: '2026-10-28T13:50:00Z', status: 'ok' },
  ],
}

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue(structuredClone(snapshot))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('shows full USD prices, signed daily percentages and each source time', async () => {
  renderWithProviders(<AppLayout />, ['/events'])

  expect(await screen.findByText('$80,628.04')).toBeInTheDocument()
  expect(screen.getByText('$4,061.10')).toBeInTheDocument()
  expect(screen.getByText('$101.91')).toBeInTheDocument()
  expect(screen.getByText('+0.90%')).toBeInTheDocument()
  expect(screen.getByText('-0.33%')).toBeInTheDocument()
  expect(screen.getByText('+2.01%')).toBeInTheDocument()
  const gold = within(screen.getByRole('group', { name: 'Gold' }))
  expect(gold.getByText(/9:50 AM ET/)).toBeInTheDocument()
  expect(gold.getByRole('link')).toHaveAttribute('href', 'https://finance.yahoo.com/quote/GC%3DF/')
  expect(apiClient.get).toHaveBeenCalledWith('/v1/market-assets')
})

test('preserves a real zero price and zero daily change', async () => {
  const data = structuredClone(snapshot)
  data.assets[1].price = 0
  data.assets[1].daily_change_pct = 0
  vi.mocked(apiClient.get).mockResolvedValue(data)
  renderWithProviders(<AppLayout />)

  expect(await screen.findByText('$0.00')).toBeInTheDocument()
  expect(screen.getByText('0.00%')).toBeInTheDocument()
})

test('marks an old quote as stale while preserving its last reported price', async () => {
  const data = structuredClone(snapshot)
  data.assets[0].status = 'stale'
  vi.mocked(apiClient.get).mockResolvedValue(data)
  renderWithProviders(<AppLayout />)

  expect(await screen.findByText('$4,061.10')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Gold' })).getByText('Stale')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Bitcoin' })).queryByText('Stale')).not.toBeInTheDocument()
})

test('a missing quote remains unavailable without hiding the other assets', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    ...snapshot,
    assets: [
      { ...snapshot.assets[0], price: null, daily_change_pct: null, quoted_at: null, status: 'unavailable' },
      ...snapshot.assets.slice(1),
    ],
  })
  renderWithProviders(<AppLayout />)

  expect(await screen.findByText('$80,628.04')).toBeInTheDocument()
  const gold = within(screen.getByRole('group', { name: 'Gold' }))
  expect(gold.getByText('Unavailable')).toBeInTheDocument()
  expect(gold.queryByText('$0.00')).not.toBeInTheDocument()
})

test('a failed request can be retried without disrupting page navigation', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network unavailable'))
  const user = userEvent.setup()
  renderWithProviders(<AppLayout />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Prices are temporarily unavailable')
  await user.click(screen.getByRole('button', { name: 'Retry prices' }))

  expect(await screen.findByText('$80,628.04')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('one panel and cached prices remain available across different pages', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AppLayout />, ['/events'])
  await screen.findByText('$80,628.04')

  await user.click(screen.getByRole('link', { name: 'Discover' }))
  await user.click(screen.getByRole('link', { name: 'Macro' }))

  expect(screen.getAllByRole('complementary', { name: 'Market prices' })).toHaveLength(1)
  expect(screen.getByText('$80,628.04')).toBeInTheDocument()
  expect(apiClient.get).toHaveBeenCalledTimes(1)
})
