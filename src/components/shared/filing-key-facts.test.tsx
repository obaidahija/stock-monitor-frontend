import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { FilingKeyFact } from '@/types/api'
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
