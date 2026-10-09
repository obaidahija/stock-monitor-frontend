import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
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

afterEach(cleanup)

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
