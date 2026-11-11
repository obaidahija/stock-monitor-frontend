import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { EarningsReportsOut, FilingFinding, SecVerification } from '@/types/api'
import { EarningsReportsPanel } from './earnings-reports'
import { useEarningsReports, useRefreshEarningsReports } from './earnings-report-hooks'

vi.mock('./earnings-report-hooks', () => ({
  useEarningsReports: vi.fn(),
  useRefreshEarningsReports: vi.fn(),
}))

const evidence = {
  source_id: 'ce0g0p0', content_hash: 'a'.repeat(64), section: 'Guidance and outlook',
  excerpt: 'For fiscal 2027 management expects revenue of $130 to $140 million.',
  source_url: 'https://www.sec.gov/Archives/edgar/data/1/123/release.htm',
}
function finding(topic: string, fact: string, extra: Partial<FilingFinding> = {}): FilingFinding {
  return {
    topic, fact, why_it_matters: `Why: ${fact}`, direction: 'positive', importance: 'medium',
    evidence_quality: 'direct', change: 'not_compared', evidence, prior_evidence: null, numbers: [],
    ...extra,
  }
}
const report: EarningsReportsOut['reports'][number] = {
  filing_id: 7, accession_number: '0000000001-26-000001', form_type: '8-K',
  available_at: '2026-11-10T21:05:00Z', filing_url: evidence.source_url,
  guidance_status: 'identified',
  analysis: {
    status: 'completed', summary: 'Revenue increased and management provided an outlook.',
    key_facts: [{
      metric: 'eps', label: 'EPS', value: '1.20', currency: '$', unit: null,
      period: 'quarter ended September 30, 2026', period_end: '2026-09-30',
      period_kind: 'quarter', basis: 'gaap', importance: 'medium', warning: false,
      change: null, evidence: [evidence],
    }],
    findings: [
      finding('guidance', 'Management forecasts revenue of $130 to $140 million.', { direction: 'unclear', importance: 'high' }),
      finding('agreement', 'The company signed a new customer contract.'),
    ],
  },
}
const mutate = vi.fn()

function saved(data: EarningsReportsOut = { ticker: 'NVDA', enabled: true, source: 'sec_edgar', reports: [report] }) {
  vi.mocked(useEarningsReports).mockReturnValue({
    data, isPending: false, isError: false, error: null, refetch: vi.fn(),
  } as never)
  return renderWithProviders(<EarningsReportsPanel ticker="NVDA" />)
}
function one(analysis: Partial<EarningsReportsOut['reports'][number]['analysis']>, extra = {}) {
  return saved({ ticker: 'NVDA', enabled: true, source: 'sec_edgar', reports: [{
    ...report, ...extra, analysis: { ...report.analysis, ...analysis },
  }] })
}

beforeEach(() => {
  mutate.mockReset()
  vi.mocked(useRefreshEarningsReports).mockReturnValue({ mutate, isPending: false } as never)
})
afterEach(cleanup)

test('values sit in compact chips with their financial period, and the summary paragraph is gone', () => {
  saved()
  expect(screen.getByText('SEC earnings briefs')).toBeInTheDocument()
  expect(screen.getByText('GAAP EPS')).toBeInTheDocument()
  expect(screen.getByText('$1.20')).toBeInTheDocument()
  expect(screen.getByText('Quarter · Sep 30, 2026')).toBeInTheDocument()
  expect(screen.queryByText(report.analysis.summary!)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'SEC filing' })).toHaveAttribute('href', evidence.source_url)
})

test('findings are split into tabs with counts and only one list shows at a time', async () => {
  const user = userEvent.setup()
  saved()
  expect(screen.getByRole('tab', { name: 'Highlights 0' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Guidance 1' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Developments 1' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Risks & notes 0' })).toBeInTheDocument()
  expect(screen.getByText(report.analysis.findings![0].fact)).toBeVisible()
  expect(screen.queryByText(report.analysis.findings![1].fact)).not.toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Developments 1' }))
  expect(screen.getByText(report.analysis.findings![1].fact)).toBeVisible()
})

test('each line shows only the fact until opened, then the reason and SEC quote', () => {
  saved()
  const fact = report.analysis.findings![0].fact
  expect(screen.getByText(`Why: ${fact}`)).not.toBeVisible()
  fireEvent.click(screen.getByText(fact))
  expect(screen.getByText(`Why: ${fact}`)).toBeVisible()
  const line = screen.getByText(fact).closest('details')!
  expect(within(line).getByRole('link', { name: /SEC source/ })).toHaveAttribute('href', evidence.source_url)
})

test('lines are ordered by importance and carry their direction for screen readers', async () => {
  const user = userEvent.setup()
  one({ findings: [
    finding('performance', 'Low item.', { importance: 'low' }),
    finding('performance', 'High item.', { importance: 'high', direction: 'negative' }),
  ] })
  await user.click(screen.getByRole('tab', { name: 'Highlights 2' }))
  const panel = screen.getByRole('tabpanel')
  const text = panel.textContent ?? ''
  expect(text.indexOf('High item.')).toBeLessThan(text.indexOf('Low item.'))
  expect(within(panel).getByText('negative')).toHaveClass('sr-only')
})

test('accounting notes sit with risks', async () => {
  const user = userEvent.setup()
  one({ findings: [finding('accounting', 'Company uses non-GAAP measures.', { direction: 'neutral' })] })
  await user.click(screen.getByRole('tab', { name: 'Risks & notes 1' }))
  expect(screen.getByText('Company uses non-GAAP measures.')).toBeVisible()
})

test('earlier releases switch by filing-date pills', async () => {
  const user = userEvent.setup()
  saved({ ticker: 'NVDA', enabled: true, source: 'sec_edgar', reports: [report, {
    ...report, filing_id: 8, available_at: '2026-08-26T20:21:19Z',
    analysis: { ...report.analysis, findings: [finding('guidance', 'August outlook.')] },
  }] })
  expect(screen.getByRole('button', { name: 'Nov 10' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'Aug 26' }))
  expect(screen.getByText('August outlook.')).toBeVisible()
  expect(screen.getByText(/Filed Aug 26/)).toBeInTheDocument()
})

test('the filing date stays distinct from the financial period', () => {
  one({ key_facts: [{ ...report.analysis.key_facts![0], period: 'quarter ended July 26, 2026', period_end: '2026-07-26' }] },
    { available_at: '2026-08-26T20:21:19Z' })
  expect(screen.getByText(/Filed Aug 26/)).toBeInTheDocument()
  expect(screen.getByText('Quarter · Jul 26, 2026')).toBeInTheDocument()
})

test.each([
  ['2026-11-10T00:00:00Z', '2026-08-26T00:00:00+00:00', 'Nov 10', 'Aug 26', 'Filed Aug 26, 2026'],
  ['2027-01-01T00:00:00.000Z', '2026-12-31T00:00:00Z', 'Jan 1', 'Dec 31, 2026', 'Filed Dec 31, 2026'],
  ['2027-01-02T01:00:00Z', '2027-01-01T01:00:00Z', 'Jan 1', 'Dec 31, 2026', 'Filed Dec 31'],
])('filing selectors preserve fallback dates and real ET instants: %s', async (
  newest, older, newestLabel, olderLabel, header,
) => {
  saved({ ticker: 'NVDA', enabled: true, source: 'sec_edgar', reports: [
    { ...report, available_at: newest },
    { ...report, filing_id: 8, available_at: older },
  ] })
  expect(screen.getByRole('button', { name: newestLabel })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.setup().click(screen.getByRole('button', { name: olderLabel }))
  expect(screen.getByText(new RegExp(header))).toBeInTheDocument()
})

const check = (status: SecVerification['status'], extra: Partial<SecVerification> = {}): SecVerification => ({
  status, reason: null, sec_value: null, sec_value_scaled: null, concept: null, form: '10-Q',
  accession: null, filed: '2026-11-06', source_url: 'https://www.sec.gov/10q.htm',
  revised_value: null, revised_filing: null, ...extra,
})

test('value chips mark SEC verification and a differing 10-Q value leads', () => {
  const eps = report.analysis.key_facts![0]
  one({ key_facts: [
    { ...eps, label: 'Revenue', metric: 'revenue', basis: 'reported', value: '41,155', unit: 'million', sec_verification: check('matched') },
    { ...eps, label: 'Cash', metric: 'cash_and_equivalents', basis: 'reported', value: '2,735', unit: 'million', period_kind: 'instant', sec_verification: check('differs', { sec_value_scaled: '6,935' }) },
    { ...eps, sec_verification: check('pending', { form: null, filed: null }) },
  ] })
  expect(screen.getByLabelText('Verified against 10-Q filed Nov 6, 2026')).toHaveTextContent('✓')
  expect(screen.getByLabelText('Awaiting 10-Q')).toHaveTextContent('◷')
  const amount = screen.getByText('$6,935 million')
  expect(amount.closest('details')).toHaveClass('border-amber-500')
  fireEvent.click(amount)
  expect(screen.getByText('Press release reported $2,735 million; 10-Q reports $6,935 million')).toBeVisible()
})

test('partial coverage does not assert that the company gave no guidance', async () => {
  const user = userEvent.setup()
  one({ status: 'partial', findings: [], key_facts: [] }, { guidance_status: 'not_identified' })
  await user.click(screen.getByRole('tab', { name: 'Guidance 0' }))
  expect(screen.getByText(/Guidance could not be fully assessed/)).toBeInTheDocument()
  expect(screen.queryByText(/No guidance disclosed/)).not.toBeInTheDocument()
})

test('pending analysis is distinct from no guidance identified', () => {
  one({ status: 'pending' }, { guidance_status: 'pending' })
  expect(screen.getByText(/Queued for analysis/)).toBeInTheDocument()
  expect(screen.queryByText(/No guidance identified/)).not.toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

test('refresh checks SEC even when there is no Yahoo earnings date', () => {
  saved({ ticker: 'NVDA', enabled: true, source: 'sec_edgar', reports: [] })
  expect(screen.getByText('No SEC earnings release saved yet')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh SEC reports' }))
  expect(mutate).toHaveBeenCalledTimes(1)
})

test('failed analysis retains the source link and a retry action', () => {
  one({ status: 'failed' }, { guidance_status: 'unavailable' })
  expect(screen.getByText(/Analysis unavailable/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'SEC filing' })).toHaveAttribute('href', evidence.source_url)
  expect(screen.getByRole('button', { name: 'Refresh SEC reports' })).toBeEnabled()
})

const fullCoverage = {
  partial: true, selected_chars: 44000, available_chars: 44000,
  comparison_status: 'not_applicable', comparison_kind: 'current release', prior_accession: null,
  document_discovery_complete: true, sections: [], excluded_sections: [],
  source_text_complete: true, verification_complete: false, chunks_total: 7, chunks_processed: 7,
}

test('full text with excluded claims is a badge with the explanation on hover', () => {
  one({ status: 'partial', coverage: fullCoverage, omitted_findings: 1 })
  expect(screen.getByText('Full release read')).toHaveAttribute('title', expect.stringMatching(/Unverified claims were excluded/))
  expect(screen.queryByText(/Some source text/)).not.toBeInTheDocument()
  expect(screen.queryByText('Partial coverage')).not.toBeInTheDocument()
})

test('a failed pass keeps an explicit partial-source label and retry information', () => {
  one({ status: 'partial', coverage: { ...fullCoverage, source_text_complete: false, chunks_processed: 6, selected_chars: 39000 } })
  expect(screen.getByText('Partial coverage')).toBeInTheDocument()
  expect(screen.getByText(/6 of 7 parts processed/)).toBeInTheDocument()
  expect(screen.queryByText('Full release read')).not.toBeInTheDocument()
})

test('processing shows the progress of the full release passes', () => {
  one({ status: 'processing', coverage: { ...fullCoverage, source_text_complete: false, chunks_processed: 2 } })
  expect(screen.getByRole('status')).toHaveTextContent('2 of 7 parts processed')
})

test('processing all saved text does not hide incomplete SEC document discovery', () => {
  one({ status: 'partial', coverage: { ...fullCoverage, source_text_complete: false, document_discovery_complete: false } })
  expect(screen.getByText(/SEC document discovery is incomplete/)).toBeInTheDocument()
  expect(screen.queryByText('Full release read')).not.toBeInTheDocument()
})
