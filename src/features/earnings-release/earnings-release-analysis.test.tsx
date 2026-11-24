import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { FilingAnalysis, FilingFinding, FilingKeyFact } from '@/types/api'
import { EarningsReleaseAnalysis } from './earnings-release-analysis'

afterEach(cleanup)

const evidence = {
  source_id: 'release-1', content_hash: 'a'.repeat(64), section: 'Results and outlook',
  excerpt: 'Management forecasts revenue of $130 to $140 million.',
  source_url: 'https://investors.example.com/earnings-release',
}
const fact: FilingKeyFact = {
  metric: 'eps', label: 'EPS', value: '1.20', currency: '$', unit: null,
  period: 'quarter ended September 30, 2026', period_end: '2026-09-30',
  period_kind: 'quarter', basis: 'gaap', importance: 'medium', warning: false,
  change: null, evidence: [evidence],
}
function finding(topic: string, text: string, extra: Partial<FilingFinding> = {}): FilingFinding {
  return {
    topic, fact: text, why_it_matters: `Why: ${text}`, direction: 'positive', importance: 'medium',
    evidence_quality: 'direct', change: 'not_compared', evidence, prior_evidence: null, numbers: [], ...extra,
  }
}
const fullCoverage: NonNullable<FilingAnalysis['coverage']> = {
  partial: false, selected_chars: 44000, available_chars: 44000,
  comparison_status: 'not_applicable', comparison_kind: 'current release', prior_accession: null,
  document_discovery_complete: true, sections: [], excluded_sections: [],
  source_text_complete: true, verification_complete: true, chunks_total: 7, chunks_processed: 7,
}

test('guidance is the default even when reported performance findings arrive first', () => {
  renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'completed', key_facts: [fact], findings: [
    finding('performance', 'Reported revenue increased.'), finding('guidance', 'Management forecasts revenue growth.'),
  ] }} />)
  expect(screen.getByText('$1.20')).toBeVisible()
  expect(screen.getByText(/Reported results · Quarter · Sep 30, 2026/)).toBeVisible()
  expect(screen.getByRole('tab', { name: 'Guidance 1' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('Management forecasts revenue growth.')).toBeVisible()
  expect(screen.queryByText('Reported revenue increased.')).not.toBeInTheDocument()
})

test('findings retain their reason, original evidence and priority across the full release', async () => {
  const user = userEvent.setup()
  renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'completed', findings: [
    finding('performance', 'Low item.', { importance: 'low' }),
    finding('performance', 'High item.', { importance: 'high', direction: 'negative' }),
    finding('accounting', 'Uses non-GAAP measures.'),
    finding('new_business_topic', 'A new product was announced.'),
  ] }} />)
  await user.click(screen.getByRole('tab', { name: 'Highlights 2' }))
  const panel = screen.getByRole('tabpanel')
  const text = panel.textContent ?? ''
  expect(text.indexOf('High item.')).toBeLessThan(text.indexOf('Low item.'))
  expect(within(panel).getByText('negative')).toHaveClass('sr-only')
  expect(screen.getByText('Why: High item.')).not.toBeVisible()
  fireEvent.click(screen.getByText('High item.'))
  expect(screen.getByText('Why: High item.')).toBeVisible()
  expect(within(screen.getByText('High item.').closest('details')!).getByRole('link', { name: /Release source/ })).toHaveAttribute('href', evidence.source_url)
  await user.click(screen.getByRole('tab', { name: 'Risks & notes 1' }))
  expect(screen.getByText('Uses non-GAAP measures.')).toBeVisible()
  await user.click(screen.getByRole('tab', { name: 'Developments 1' }))
  expect(screen.getByText('A new product was announced.')).toBeVisible()
})

test('a release figure shows its value and opens to its wording and evidence', () => {
  renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'completed', key_facts: [
    { ...fact, label: 'Cash', metric: 'cash_and_equivalents', basis: 'reported', value: '2,735', unit: 'million', period_kind: 'instant' },
  ] }} />)
  const amount = screen.getByText('$2.74B')
  expect(screen.getByRole('columnheader', { name: 'Value' })).toBeVisible()
  expect(screen.queryByText(`“${evidence.excerpt}”`)).not.toBeInTheDocument()
  fireEvent.click(amount)
  expect(screen.getByRole('button', { name: /Cash/ })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('$2,735 million')).toBeVisible()
  expect(screen.getByText(`“${evidence.excerpt}”`)).toBeVisible()
})

test('reported and adjusted statements of one figure share a row', () => {
  renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'completed', key_facts: [
    { ...fact, basis: 'gaap', value: '2.70' },
    { ...fact, basis: 'adjusted', value: '2.68', unit: 'per share', period_end: null, period: 'Q3 FY27', yoy_change: '+111.0%' },
  ] }} />)
  const row = screen.getByRole('row', { name: /EPS/ })
  expect(within(row).getByText('$2.70')).toBeVisible()
  expect(within(row).getByText('$2.68')).toBeVisible()
  expect(within(row).getByText('+111.0% y/y')).toBeVisible()
  expect(screen.getByRole('columnheader', { name: 'Adjusted' })).toBeVisible()
})

test('distinguishes complete release coverage with excluded claims from incomplete source coverage', () => {
  const view = renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'partial', coverage: fullCoverage, omitted_findings: 1 }} />)
  expect(screen.getByText('Full release read')).toHaveAttribute('title', expect.stringContaining('Unverified claims were excluded'))
  expect(screen.queryByText('Partial coverage')).not.toBeInTheDocument()
  view.rerender(<EarningsReleaseAnalysis analysis={{ status: 'partial', coverage: { ...fullCoverage, source_text_complete: false, chunks_processed: 6 } }} />)
  expect(screen.getByText('Partial coverage')).toBeVisible()
  expect(screen.getByText(/6 of 7 parts processed/)).toBeVisible()
  expect(screen.queryByText('Full release read')).not.toBeInTheDocument()
  expect(screen.getByText(/Guidance could not be fully assessed/)).toBeVisible()
})

test('does not label discovery-incomplete analysis as a full release read', () => {
  renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'partial', coverage: { ...fullCoverage, document_discovery_complete: false } }} />)
  expect(screen.getByText('Partial coverage')).toBeVisible()
  expect(screen.queryByText('Full release read')).not.toBeInTheDocument()
})

test('pending results do not expose an older saved brief or claim guidance is absent', () => {
  renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'pending', previous_analysis: {
    status: 'completed', key_facts: [fact], findings: [finding('guidance', 'Previous outlook')],
  } }} />)
  expect(screen.getByText(/Queued for full-release analysis/)).toBeVisible()
  expect(screen.queryByText('Previous outlook')).not.toBeInTheDocument()
  expect(screen.queryByText('$1.20')).not.toBeInTheDocument()
  expect(screen.queryByText(/No guidance identified/)).not.toBeInTheDocument()
})

test('a reported value shows the same row a year earlier and the change', () => {
  const revenue: FilingKeyFact = {
    ...fact, metric: 'revenue', label: 'Revenue', value: '10,409', unit: 'million', basis: 'reported',
    prior_value: '6,800', prior_period: 'October 26, 2025', yoy_change: '+53.1%',
  }
  const margin: FilingKeyFact = {
    ...fact, metric: 'gross_margin', label: 'Gross margin', value: '50.4', currency: null, unit: '%',
    basis: 'reported', prior_value: '48.0', prior_period: 'Q4 FY2025', yoy_change: '+2.4 pts',
  }
  renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'completed', key_facts: [revenue, margin], findings: [] }} />)
  expect(screen.getByText('$10.41B')).toBeVisible()
  expect(screen.getByText('+53.1% y/y')).toBeVisible()
  expect(screen.getByText('50.4%')).toBeVisible()
  expect(screen.getByText('+2.4 pts y/y')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Revenue/ }))
  fireEvent.click(screen.getByRole('button', { name: /Gross margin/ }))
  expect(screen.getByText('$10,409 million')).toBeVisible()
  expect(screen.getByText('Year ago $6,800 million (October 26, 2025) · +53.1%')).toBeVisible()
  expect(screen.getByText('Year ago 48.0% (Q4 FY2025) · +2.4 pts')).toBeVisible()
})

test('an analysis that does not apply to the release shows nothing', () => {
  const { container } = renderWithProviders(<EarningsReleaseAnalysis analysis={{ status: 'unsupported' }} />)
  expect(container).toBeEmptyDOMElement()
})
