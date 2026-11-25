import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { RECENT_PAGE_SIZE } from './hooks'
import { RecentFilings } from './recent-filings'

afterEach(() => vi.restoreAllMocks())

test('a label chip filters the list on the server and a second click clears it', async () => {
  const user = userEvent.setup()
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue([] as never)
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
    accession: `0000000001-26-${String(i).padStart(6, '0')}`, ticker: 'ZZZ', cik: '1', form: '8-K',
    item_codes: ['8.01'], accepted_at: at, events: [], other_events: [], summary: null, signal: null,
    kind: 'event', coverage: 'tracked', status: 'extracted', detected_price: null, ref_close: null,
    close_1d: null, close_5d: null,
  }
}

// 500 rows of five price cards take a few seconds to render in jsdom.
test('a full page offers older filings, fetched before the oldest one shown', { timeout: 20_000 }, async () => {
  const user = userEvent.setup()
  const first = Array.from({ length: RECENT_PAGE_SIZE }, (_, i) => filing(i))
  const get = vi.spyOn(apiClient, 'get').mockImplementation((url: string) =>
    Promise.resolve((String(url).includes('before=') ? [filing(RECENT_PAGE_SIZE + 100)] : String(url).includes('/recent') ? first : []) as never),
  )
  renderWithProviders(<RecentFilings onOpenFiling={() => {}} />)

  const more = await screen.findByRole('button', { name: 'Load older filings' })
  expect(screen.getByText(`${RECENT_PAGE_SIZE} filings (newest shown, more below)`)).toBeInTheDocument()
  await user.click(more)
  const oldest = encodeURIComponent(first[RECENT_PAGE_SIZE - 1].accepted_at)
  await waitFor(() => expect(get.mock.calls.some(([url]) => String(url).includes(`before=${oldest}`))).toBe(true))
  await waitFor(() => expect(screen.getByText(`${RECENT_PAGE_SIZE + 1} filings`)).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Load older filings' })).toBeNull()
})
