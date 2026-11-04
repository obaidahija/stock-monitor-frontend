import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { Toaster, toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { formatSignedPct } from '@/lib/format'
import { renderWithProviders } from '@/test/render'
import type { DigestItem, DigestTopFiling } from '@/types/api'
import { DigestItemCard } from './digest-item-card'

function itemWithSupportingFiling(filing: DigestTopFiling): DigestItem {
  return {
    ticker: 'MIXED',
    tier: 1,
    reasons: [],
    stages: ['filing'],
    premarket: null,
    premarket_gap_pct: null,
    volume_ratio: null,
    pct_from_12wk_avg: null,
    recent_pattern: null,
    top_filing: null,
    top_earnings: null,
    news_count_24h: 0,
    headline_snippets: [],
    sentiment: null,
    supporting_filings: [filing],
  }
}

const filing: DigestTopFiling = {
  form_type: '8-K',
  filed_at: '2026-10-01T12:00:00Z',
  url: 'https://www.sec.gov/Archives/example-supporting-filing.htm',
  item_codes: '4.01,1.01',
  prominence: 'primary',
  prominence_reason: 'auditor change (4.01)',
}

afterEach(() => { cleanup(); toast.dismiss(); vi.restoreAllMocks() })

test('expanded supporting filings retain every mixed item code with the source and topic', async () => {
  const user = userEvent.setup()
  renderWithProviders(<DigestItemCard item={itemWithSupportingFiling(filing)} />)

  await user.click(screen.getByText('Other filings (1)'))

  const fact = screen.getByRole('listitem')
  expect(fact).toHaveTextContent(/4\.01,\s*1\.01/)
  expect(fact).toHaveTextContent('auditor change (4.01)')
  expect(fact).toHaveTextContent('Oct 1, 8:00 AM ET')
  expect(within(fact).getByRole('link', { name: '8-K' })).toHaveAttribute('href', filing.url)
})

test.each([undefined, null, ''])('supporting filings without stored codes (%s) still expose their source', async (itemCodes) => {
  const user = userEvent.setup()
  renderWithProviders(<DigestItemCard item={itemWithSupportingFiling({ ...filing, item_codes: itemCodes })} />)

  await user.click(screen.getByText('Other filings (1)'))

  const fact = screen.getByRole('listitem')
  expect(within(fact).getByRole('link', { name: '8-K' })).toHaveAttribute('href', filing.url)
  expect(fact).toHaveTextContent('auditor change (4.01)')
  expect(fact).not.toHaveTextContent('Item codes:')
})

test('a supporting filing known only by its date shows no invented time', async () => {
  const user = userEvent.setup()
  renderWithProviders(<DigestItemCard item={itemWithSupportingFiling({ ...filing, filed_at: '2026-10-01T00:00:00Z' })} />)

  await user.click(screen.getByText('Other filings (1)'))

  const fact = screen.getByRole('listitem')
  expect(fact).toHaveTextContent('Oct 1, 2026')
  expect(fact).not.toHaveTextContent('PM ET')
})

test('shows the premarket move relative to SPY when the digest has one', () => {
  renderWithProviders(
    <DigestItemCard
      item={{
        ...itemWithSupportingFiling(filing),
        supporting_filings: [],
        premarket_gap_pct: -6,
        premarket_gap_vs_spy_pct: -4,
      }}
    />,
  )

  expect(screen.getByText(/vs SPY/)).toHaveTextContent(
    `Premarket ${formatSignedPct(-6)} (${formatSignedPct(-4)} vs SPY)`,
  )
})

test('legacy headlines can be expanded and read without inventing source links', async () => {
  const user = userEvent.setup()
  const title = 'A complete saved headline that should remain readable at any card width'
  renderWithProviders(<DigestItemCard item={{ ...itemWithSupportingFiling(filing), supporting_filings: [], headline_snippets: [title] }} />)

  await user.click(screen.getByText('Headlines (1)'))

  expect(screen.getByText(title)).toBeVisible()
  expect(screen.queryByRole('link', { name: title })).not.toBeInTheDocument()
})

test('new headlines expose saved sources but reject executable URLs', async () => {
  const user = userEvent.setup()
  renderWithProviders(<DigestItemCard item={{ ...itemWithSupportingFiling(filing), supporting_filings: [],
    headline_snippets: ['Issuer announces agreement', 'Unsafe reference'], headlines: [
      { title: 'Issuer announces agreement', url: 'https://example.com/agreement', source: 'Issuer newsroom', published_at: '2026-11-03T12:00:00Z' },
      { title: 'Unsafe reference', url: 'javascript:alert(1)', source: null, published_at: null },
    ],
  }} />)

  await user.click(screen.getByText('Headlines (2)'))

  const source = screen.getByRole('link', { name: 'Issuer announces agreement' })
  expect(source).toHaveAttribute('href', 'https://example.com/agreement')
  expect(source).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByText(/Issuer newsroom/)).toHaveTextContent('Nov 3, 7:00 AM ET')
  expect(screen.queryByRole('link', { name: 'Unsafe reference' })).not.toBeInTheDocument()
})

test('hiding a ticker offers Undo that restores its dismissal', async () => {
  const user = userEvent.setup()
  vi.spyOn(apiClient, 'delete').mockResolvedValue(undefined)
  const restore = vi.spyOn(apiClient, 'post').mockResolvedValue(undefined)
  renderWithProviders(<><DigestItemCard item={itemWithSupportingFiling(filing)} /><Toaster /></>)

  await user.click(screen.getByRole('button', { name: 'Hide MIXED from digest' }))
  await user.click(await screen.findByRole('button', { name: 'Undo' }))

  expect(restore).toHaveBeenCalledWith('/v1/digest/MIXED/restore')
  expect(await screen.findByText('MIXED restored to digest coverage')).toBeVisible()
})
