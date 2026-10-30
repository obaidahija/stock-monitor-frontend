import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { apiClient } from '@/lib/api-client'
import { FilingFinancialOverviewPanel } from './filing-financial-overview'

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

test('reads saved dated company facts with a filing source and never submits analysis', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ticker: 'ICE', source: 'manually_analyzed_filings', missing_metrics: [], facts: [{
    metric: 'outstanding_debt', label: 'Outstanding debt', value: '23.3', currency: '$', unit: 'billion',
    period: 'September 30, 2026', period_end: '2026-09-30', period_kind: 'instant', basis: 'reported',
    importance: 'medium', warning: false, change: null, evidence: [],
    filing_id: 67238, form_type: '8-K', filing_url: 'https://www.sec.gov/ice.htm',
  }] })
  renderWithProviders(<FilingFinancialOverviewPanel ticker="ICE" />)
  expect(await screen.findByText('$23.3 billion')).toBeInTheDocument()
  expect(screen.getByText('As of September 30, 2026')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Source filing: 8-K' })).toHaveAttribute('href', 'https://www.sec.gov/ice.htm')
  expect(apiClient.get).toHaveBeenCalledWith('/v1/stocks/ICE/filings/financial-overview')
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('missing balances display unavailable rather than zero and do not trigger a model', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ ticker: 'ICE', source: 'manually_analyzed_filings', missing_metrics: ['outstanding_debt', 'unrestricted_cash'], facts: [] })
  renderWithProviders(<FilingFinancialOverviewPanel ticker="ICE" />)
  expect(await screen.findByText(/Not available from analyzed filings: Outstanding debt, Unrestricted cash/)).toBeInTheDocument()
  expect(screen.queryByText('$0')).not.toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
})
