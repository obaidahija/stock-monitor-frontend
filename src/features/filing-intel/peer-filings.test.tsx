import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { PeerFilings } from './peer-filings'

afterEach(() => vi.restoreAllMocks())

test('peers show the industry, a summary and each filing with its next-day move', async () => {
  const user = userEvent.setup()
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    basis: { level: 'sic', code: '2000', name: 'Food and Kindred Products' },
    summary: { count: 2, tickers: 2, same_kind: 1, positive_share: 0.5, mean_move_1d_pct: 1.2, mean_excess_1d: 0.4 },
    filings: [
      { accession: 'a1', ticker: 'CAG', form: '8-K', kind: 'earnings', accepted_at: '2026-11-20T12:00:00Z',
        summary: null, label: 'positive', strength: 'strong', move_1d_pct: 3.1, excess_1d: 2.0, market_cap: 12e9 },
      { accession: 'a2', ticker: 'POST', form: '8-K', kind: 'event', accepted_at: '2026-11-18T12:00:00Z',
        summary: null, label: 'negative', strength: 'single', move_1d_pct: -0.7, excess_1d: -1.2, market_cap: 6e9 },
    ],
  } as never)
  const onOpen = vi.fn()
  renderWithProviders(<PeerFilings accession="x" onOpen={onOpen} />)

  expect(await screen.findByText('Food and Kindred Products')).toBeInTheDocument()
  expect(screen.getByText('50% positive')).toBeInTheDocument()
  expect(screen.getByText('+3.1%')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /CAG/ }))
  expect(onOpen).toHaveBeenCalledWith('a1')
})
