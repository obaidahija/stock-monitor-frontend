import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { FilingOut } from '@/types/api'
import { NotableFilingsSection } from './notable-filings-section'

function filing(id: number, overrides: Partial<FilingOut> = {}): FilingOut {
  return {
    id, ticker: `T${id}`, cik: '0000046765', accession_number: `acc-${id}`, form_type: '8-K',
    filed_at: '2026-10-07T16:20:20Z', filing_url: `https://www.sec.gov/${id}`,
    title: `8-K - Company ${id}, Inc. (0000046765) (Filer)`, item_codes: '2.02,9.01',
    is_notable: true, source: 'edgar_feed', ...overrides,
  }
}

const filings = vi.hoisted(() => ({ rows: [] as FilingOut[] }))

vi.mock('./hooks', () => ({
  useNotableFilings: () => ({ data: filings.rows, isPending: false, isError: false, error: null, refetch: vi.fn() }),
}))

afterEach(cleanup)

test('shows company, items in words and New York time, 15 per page', async () => {
  const user = userEvent.setup()
  filings.rows = Array.from({ length: 16 }, (_, i) =>
    filing(i + 1, i === 0 ? { ticker: 'HP', title: '8-K - Helmerich & Payne, Inc. (0000046765) (Filer)' } : {}),
  )
  renderWithProviders(<NotableFilingsSection />)

  expect(screen.getByText('Helmerich & Payne, Inc.')).toBeInTheDocument()
  expect(screen.getAllByText('Results')).toHaveLength(15)
  expect(screen.getAllByText('Oct 7, 12:20 PM ET')).toHaveLength(15)
  expect(screen.getByText('Showing 1–15 of 16')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByText('T16')).toBeInTheDocument()
})

test('shows a date-only filing as its date, not an invented evening time', () => {
  filings.rows = [filing(1, { filed_at: '2026-10-07T00:00:00Z' })]
  renderWithProviders(<NotableFilingsSection />)

  expect(screen.getByText('Oct 7, 2026')).toBeInTheDocument()
  expect(screen.queryByText(/8:00 PM/)).not.toBeInTheDocument()
})

test('long company names and item lists wrap instead of being cut off', () => {
  filings.rows = [filing(1, { item_codes: '1.01,1.02,2.03,4.02' })]
  renderWithProviders(<NotableFilingsSection />)

  const items = screen.getByText('Material agreement · Agreement terminated · New debt obligation · Restatement')
  expect(items).not.toHaveClass('truncate')
  expect(screen.getByText('Company 1, Inc.')).not.toHaveClass('truncate')
})
