import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { FilingOut } from '@/types/api'
import { FilingsTab } from './filings-tab'

const filings: FilingOut[] = [
  {
    id: 1, ticker: 'NVDA', cik: '0001045810', accession_number: 'a1', form_type: '4',
    filed_at: '2026-09-23T00:00:00Z', filing_url: 'https://www.sec.gov/a1', title: 'FORM 4',
    item_codes: null, is_notable: false, source: 'edgar',
  },
  {
    id: 2, ticker: 'NVDA', cik: '0001045810', accession_number: 'a2', form_type: '8-K',
    filed_at: '2026-10-07T16:20:20Z', filing_url: 'https://www.sec.gov/a2', title: '8-K',
    item_codes: '2.02,9.01', is_notable: true, source: 'edgar',
  },
]

vi.mock('./hooks', () => ({
  useFilings: () => ({ data: filings, isPending: false, isError: false, error: null, refetch: vi.fn() }),
}))

afterEach(cleanup)

test('labels forms and items in words and shows filing dates without a fake time', () => {
  render(<FilingsTab ticker="NVDA" />)

  expect(screen.getByText('Insider trade')).toBeInTheDocument()
  expect(screen.getByText('Sep 23, 2026')).toBeInTheDocument()
  expect(screen.queryByText('FORM 4')).not.toBeInTheDocument()
  expect(screen.getByText('Current report')).toBeInTheDocument()
  expect(screen.getByText('Results')).toBeInTheDocument()
  expect(screen.getByText('Oct 7, 12:20 PM ET')).toBeInTheDocument()
})
