import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { RECENT_PAGE_SIZE } from './hooks'
import { RecentFilings } from './recent-filings'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

test('a label chip filters the list on the server and a second click clears it', async () => {
  const user = userEvent.setup()
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 } as never)
  renderWithProviders(<RecentFilings onOpenFiling={() => {}} />)
  const urls = () => get.mock.calls.map(([url]) => String(url)).filter((u) => u.includes('/recent'))

  const strong = screen.getByRole('button', { name: 'Strong positive' })
  await user.click(strong)
  await waitFor(() => expect(urls().some((u) => u.includes('signal=strong_positive'))).toBe(true))
  expect(strong).toHaveAttribute('aria-pressed', 'true')

  await user.click(strong)
  expect(strong).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Any label' })).toBeInTheDocument()
})

function filing(i: number) {
  const at = new Date(Date.UTC(2026, 10, 25, 12) - i * 60_000).toISOString()
  return {
    accession: `0000000001-26-${String(i).padStart(6, '0')}`, ticker: `ZZZ${i}`, cik: '1', form: '8-K',
    item_codes: ['8.01'], accepted_at: at, events: [], other_events: [], summary: null, signal: null,
    kind: 'event', coverage: 'tracked', status: 'extracted', detected_price: null, ref_close: null,
    close_1d: null, close_5d: null,
  }
}

test('defaults to 24h and loads filings and prices in pages of 20 on demand', async () => {
  const user = userEvent.setup()
  const first = Array.from({ length: RECENT_PAGE_SIZE }, (_, i) => filing(i))
  const get = vi.spyOn(apiClient, 'get').mockImplementation((url: string) =>
    Promise.resolve((String(url).includes('/recent') ? { items: String(url).includes('page=2') ? [filing(120)] : first, total: 21, page: String(url).includes('page=2') ? 2 : 1, page_size: 20 } : []) as never),
  )
  renderWithProviders(<RecentFilings onOpenFiling={() => {}} />)

  const more = await screen.findByRole('button', { name: 'Next' })
  expect(RECENT_PAGE_SIZE).toBe(20)
  const recentCalls = () => get.mock.calls.filter(([url]) => String(url).includes('/recent'))
  expect(recentCalls()).toHaveLength(1)
  const initial = new URL(String(recentCalls()[0][0]), 'http://localhost')
  expect(initial.searchParams.get('hours')).toBe('24')
  expect(initial.searchParams.get('limit')).toBe('20')
  expect(initial.searchParams.has('before')).toBe(false)
  await waitFor(() => expect(get.mock.calls.some(([url]) => String(url).includes('/prices?'))).toBe(true))
  const priceUrl = get.mock.calls.find(([url]) => String(url).includes('/prices?'))![0]
  expect(new URL(String(priceUrl), 'http://localhost').searchParams.get('tickers')?.split(',')).toHaveLength(20)
  expect(screen.getByText('21 filings')).toBeInTheDocument()
  await user.click(more)
  await waitFor(() => expect(screen.getByText('Page 2 of 2')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  const priceUrls = get.mock.calls.filter(([url]) => String(url).includes('/prices?'))
  await waitFor(() => expect(get.mock.calls.some(([url]) => String(url).includes('tickers=ZZZ120'))).toBe(true))
  expect(priceUrls.every(([url]) => !String(url).includes('ZZZ120%2C'))).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  await screen.findByText('Page 1 of 2')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Page 2 of 2')
  await user.click(screen.getByRole('button', { name: '3 days' }))
  await screen.findByText('Page 1 of 2')
  expect(get.mock.calls.some(([url]) => String(url).includes('page=1') && String(url).includes('hours=72'))).toBe(true)
})
