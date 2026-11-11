import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { FilingKeyFact, SecVerification } from '@/types/api'
import { FilingKeyFacts } from './filing-key-facts'

export const debtFact: FilingKeyFact = {
  metric: 'outstanding_debt', label: 'Outstanding debt', value: '23.3', currency: '$', unit: 'billion',
  period: 'September 30, 2026', period_end: '2026-09-30', period_kind: 'instant', basis: 'reported',
  importance: 'medium', warning: false, change: null,
  evidence: [{ source_id: 'c0', excerpt: 'Outstanding debt was $23.3 billion as of September 30, 2026.',
    source_url: 'https://www.sec.gov/ice.htm', section: 'Financial disclosure', content_hash: 'hash' }],
}

afterEach(cleanup)

test('amount date and neutral debt styling are visible without expanding evidence', () => {
  render(<FilingKeyFacts facts={[debtFact]} />)
  const amount = screen.getByText('$23.3 billion')
  expect(amount.tagName).toBe('STRONG')
  expect(screen.getByText('As of September 30, 2026')).toBeInTheDocument()
  expect(amount.closest('article')).not.toHaveClass('border-amber-500')
  expect(screen.getByRole('link', { name: 'SEC source · Financial disclosure' })).toHaveAttribute('href', 'https://www.sec.gov/ice.htm')
})

test('only explicit warning facts receive warning styling and adjusted definitions remain visible', () => {
  render(<FilingKeyFacts facts={[
    { ...debtFact, metric: 'default', label: 'Disclosed default', value: 'Missed interest payment', currency: null, unit: null, warning: true },
    { ...debtFact, metric: 'free_cash_flow', label: 'Free cash flow', value: '3.7', basis: 'adjusted', period_kind: 'year_to_date' },
  ]} />)
  expect(screen.getByText('Missed interest payment').closest('article')).toHaveClass('border-amber-500')
  expect(screen.getByText('Adjusted Free cash flow')).toBeInTheDocument()
  expect(screen.getByText('YTD through September 30, 2026')).toBeInTheDocument()
})

test('limits initial panel to six facts and provides the remaining facts', () => {
  render(<FilingKeyFacts facts={Array.from({ length: 8 }, (_, i) => ({ ...debtFact, label: `Fact ${i}`, value: `${i}` }))} />)
  expect(screen.getByText('Show all facts (8)')).toBeInTheDocument()
  expect(screen.getByText('Fact 7').closest('details')).not.toHaveAttribute('open')
})

const epsFact: FilingKeyFact = {
  ...debtFact, metric: 'eps', label: 'EPS', value: '(1.27)', unit: 'per share', period_kind: 'quarter',
}
const tenQ = 'https://www.sec.gov/Archives/edgar/data/1769628/000176962826000470/crwv-20260930.htm'
function checked(status: SecVerification['status'], extra: Partial<SecVerification> = {}): FilingKeyFact {
  return {
    ...epsFact,
    sec_verification: {
      status, reason: null, sec_value: null, sec_value_scaled: null, concept: null, form: null,
      accession: null, filed: null, source_url: null, revised_value: null, revised_filing: null, ...extra,
    },
  }
}
const found = { form: '10-Q', filed: '2026-11-10', source_url: tenQ, accession: '0001769628-26-000470' }

test('a fact without a SEC check renders no verification line', () => {
  render(<FilingKeyFacts facts={[epsFact]} />)
  expect(screen.queryByText(/10-Q|SEC data/)).not.toBeInTheDocument()
})

test('pending facts say they await the 10-Q, or the 10-K for annual periods', () => {
  render(<FilingKeyFacts facts={[checked('pending', { reason: 'awaiting_filing' }),
    { ...checked('pending'), period_kind: 'annual', label: 'Annual EPS' }]} />)
  expect(screen.getByText('Press release figure · awaiting 10-Q')).toBeInTheDocument()
  expect(screen.getByText('Press release figure · awaiting 10-K')).toBeInTheDocument()
})

test('matched facts link the verifying filing', () => {
  render(<FilingKeyFacts facts={[checked('matched', { ...found, sec_value: '-1.27', sec_value_scaled: '(1.27)' })]} />)
  expect(screen.getByRole('link', { name: 'Verified against 10-Q filed Nov 10, 2026' })).toHaveAttribute('href', tenQ)
  expect(screen.getByText('$(1.27) per share').tagName).toBe('STRONG')
})

test('a differing value shows the 10-Q figure as the headline and keeps the release figure', () => {
  render(<FilingKeyFacts facts={[checked('differs', { ...found, sec_value: '-1.3', sec_value_scaled: '(1.30)' })]} />)
  const amount = screen.getByText('$(1.30) per share')
  expect(amount.tagName).toBe('STRONG')
  expect(amount.closest('article')).toHaveClass('border-amber-500')
  expect(screen.getByText('Press release reported $(1.27) per share; 10-Q reports $(1.30) per share')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'SEC 10-Q filing' })).toHaveAttribute('href', tenQ)
})

test.each([
  ['not_tagged', 'not_tagged', 'Not checked against SEC data · not tagged in the SEC filing'],
  ['unavailable', 'awaiting_filing', 'Not checked against SEC data · no SEC filing found'],
  ['unavailable', 'conflicting_sec_facts', 'Not checked against SEC data · SEC data conflicts'],
  ['unsupported', 'non_gaap', 'Not checked against SEC data · non-GAAP figure'],
  ['unsupported', 'period_kind_not_checked', 'Not checked against SEC data · year-to-date figure'],
  ['unavailable', 'issuer_not_collected', 'Not checked against SEC data · issuer not collected'],
  ['unavailable', 'collection_disabled', 'Not checked against SEC data · collection disabled'],
  ['unsupported', 'not_us_gaap', 'Not checked against SEC data · not reported in US GAAP'],
  ['unsupported', 'currency', 'Not checked against SEC data · currency'],
] as const)('%s / %s explains why the value was not checked', (status, reason, text) => {
  render(<FilingKeyFacts facts={[checked(status, { reason })]} />)
  expect(screen.getByText(text)).toBeInTheDocument()
})

test('a later restatement is noted with its filing', () => {
  render(<FilingKeyFacts facts={[checked('matched', {
    ...found, sec_value: '-1.27', sec_value_scaled: '(1.27)', revised_value: '(1.25)',
    revised_filing: { form: '10-K', filed: '2027-02-25', accession: 'x', source_url: 'https://www.sec.gov/10k.htm' },
  })]} />)
  expect(screen.getByRole('link', { name: 'Later revised to $(1.25) per share in 10-K filed Feb 25, 2027' }))
    .toHaveAttribute('href', 'https://www.sec.gov/10k.htm')
})
