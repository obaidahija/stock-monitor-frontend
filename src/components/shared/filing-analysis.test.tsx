import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { apiClient } from '@/lib/api-client'
import { FilingAnalysisView } from './filing-analysis'

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

test('loads evidence only when expanded and preserves source links', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 'completed', summary: 'Revenue increased.', direction: 'positive', importance: 'medium',
    model: 'test-model', version: 1,
    findings: [{ topic: 'performance', fact: 'Revenue increased.', why_it_matters: 'May support earnings.',
      direction: 'positive', importance: 'medium', evidence_quality: 'direct', change: 'not_compared',
      numbers: [], prior_evidence: null,
      evidence: { source_id: 'c0', section: 'Item 2.02', source_url: 'https://www.sec.gov/Archives/test.htm',
        excerpt: 'Revenue for the quarter increased to $120 million.', content_hash: 'hash' } }],
  })
  renderWithProviders(<FilingAnalysisView ticker="NVDA" filingId={7} analysis={{ status: 'completed', summary: 'Revenue increased.', direction: 'positive', importance: 'medium' }} />)
  expect(apiClient.get).not.toHaveBeenCalled()
  await userEvent.click(screen.getByText('Findings, changes and evidence'))
  expect(await screen.findByText('“Revenue for the quarter increased to $120 million.”')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'SEC source · Item 2.02' })).toHaveAttribute('href', 'https://www.sec.gov/Archives/test.htm')
  expect(apiClient.get).toHaveBeenCalledWith('/v1/stocks/NVDA/filings/7/analysis')
  expect(screen.getByText(/not a stock-return prediction/)).toBeInTheDocument()
})

test('partial coverage is explicit without opening evidence', () => {
  renderWithProviders(<FilingAnalysisView analysis={{ status: 'partial', summary: 'Liquidity risk disclosed.', direction: 'negative', importance: 'high' }} />)
  expect(screen.getByText('Partial coverage')).toBeInTheDocument()
  expect(screen.getByText(/Coverage or extraction is incomplete/)).toBeInTheDocument()
})

test.each([
  ['pending', 'Not analyzed'], ['not_analyzed', 'Not analyzed'], ['processing', 'Analyzing disclosure'],
  ['failed', 'Analysis unavailable'], ['unsupported', 'No document analysis for this form'],
] as const)('renders %s without inventing a direction', (status, label) => {
  renderWithProviders(<FilingAnalysisView analysis={{ status }} />)
  expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.queryByText('positive')).not.toBeInTheDocument()
  expect(apiClient.get).not.toHaveBeenCalled()
})

test('Analyze sends only the selected filing after a click and disables duplicate clicks', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(apiClient.post).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  renderWithProviders(<FilingAnalysisView ticker="TSM" filingId={63460} analysis={{ status: 'not_analyzed' }} />)
  expect(apiClient.post).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /^Analyze$/ }))
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(apiClient.post).toHaveBeenCalledWith('/v1/stocks/TSM/filings/63460/analysis')
  expect(screen.getByRole('button', { name: 'Analyzing…' })).toBeDisabled()
  finish({ status: 'completed', summary: 'Revenue increased.', direction: 'positive', importance: 'medium' })
  expect(await screen.findByText('Revenue increased.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Analyze$/ })).not.toBeInTheDocument()
})

test('failed manual request offers an explicit retry without claiming one is scheduled', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ status: 'failed', attempts: 1 })
  renderWithProviders(<FilingAnalysisView ticker="TSM" filingId={58793} analysis={{ status: 'not_analyzed' }} />)
  await userEvent.click(screen.getByRole('button', { name: /^Analyze$/ }))
  expect(await screen.findByRole('button', { name: 'Retry analysis' })).toBeInTheDocument()
  expect(screen.queryByText('A retry is scheduled.')).not.toBeInTheDocument()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

test('unsupported insider form has no Analyze action', () => {
  renderWithProviders(<FilingAnalysisView ticker="TSM" filingId={1} analysis={{ status: 'unsupported' }} />)
  expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('shows a specific output-format failure beside the manual retry action', () => {
  renderWithProviders(<FilingAnalysisView ticker="TSM" filingId={63460} analysis={{
    status: 'failed', error_code: 'invalid_model_json',
  }} />)
  expect(screen.getByText(/The model did not return complete readable JSON/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry analysis' })).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('older saved analysis offers Update highlights and preserves the original summary', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ status: 'completed', version: 2, summary: 'New financial facts.', key_facts: [] })
  renderWithProviders(<FilingAnalysisView ticker="ICE" filingId={67238} analysis={{
    status: 'completed', version: 1, summary: 'Original saved summary.', needs_highlights_update: true,
  }} />)
  expect(screen.getByText('Original saved summary.')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Update highlights' }))
  expect(await screen.findByText('New financial facts.')).toBeInTheDocument()
  expect(apiClient.post).toHaveBeenCalledWith('/v1/stocks/ICE/filings/67238/analysis')
})

test('key financial facts appear before the narrative without opening details', () => {
  renderWithProviders(<FilingAnalysisView analysis={{ status: 'completed', summary: 'Narrative summary.', key_facts: [{
    metric: 'outstanding_debt', label: 'Outstanding debt', value: '23.3', currency: '$', unit: 'billion',
    period: 'September 30, 2026', period_end: '2026-09-30', period_kind: 'instant', basis: 'reported',
    importance: 'medium', warning: false, change: null, evidence: [],
  }] }} />)
  const amount = screen.getByText('$23.3 billion')
  expect(amount.compareDocumentPosition(screen.getByText('Narrative summary.')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
})
