import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { CompanyPostAnalysisOut, CompanyPostEvidenceOut } from '@/types/twitter-company'
import { CompanyPostRow } from './company-post-row'
import { companyPost } from './test-fixtures'

afterEach(cleanup)

function analysis(overrides: Partial<CompanyPostAnalysisOut> = {}): CompanyPostAnalysisOut {
  return {
    status: 'completed',
    label: 'company_news',
    importance_score: 72,
    is_company_news: true,
    reason: 'New product release',
    needs_review: false,
    analysed_at: null,
    ...overrides,
  }
}

const resultsFiling: CompanyPostEvidenceOut = {
  kind: 'sec_filing',
  form_type: '8-K',
  item_codes: ['2.02', '9.01'],
  title: '8-K - Alphabet Inc.',
  url: 'https://www.sec.gov/Archives/edgar/data/1652044/0001652044-26-000101.htm',
  filed_at: '2026-10-08T20:05:00Z',
  event_category: 'earnings_guidance',
}

test('shows the label and reason, never the raw model score', () => {
  const post = { ...companyPost('1'), analysis: analysis() }
  render(<CompanyPostRow post={post} />)
  expect(screen.getByText('Company news')).toBeInTheDocument()
  expect(screen.getByText('New product release')).toBeInTheDocument()
  expect(screen.getByText(post.text)).toBeInTheDocument()
  expect(screen.queryByText(/\/100/)).not.toBeInTheDocument()
})

test('a material post links the SEC filing that backs it', () => {
  const post = {
    ...companyPost('1'),
    analysis: analysis({ label: 'material' }),
    evidence: [resultsFiling],
  }
  render(<CompanyPostRow post={post} />)
  expect(screen.getByText('Material')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: /8-K · Items 2\.02, 9\.01/ })
  expect(link).toHaveAttribute('href', resultsFiling.url)
})

test.each([
  ['2026-10-08T00:00:00Z', 'filed Oct 8, 2026'],
  ['2026-10-08T20:05:00Z', 'filed Oct 8, 4:05 PM ET'],
])('shows the SEC filing date or precise acceptance time for %s', (filedAt, expected) => {
  const post = {
    ...companyPost('1'),
    evidence: [{ ...resultsFiling, filed_at: filedAt }],
  }
  render(<CompanyPostRow post={post} />)
  expect(screen.getByText(expected)).toBeInTheDocument()
})

test('a routine post keeps a same-topic filing as context', () => {
  const post = {
    ...companyPost('1'),
    analysis: analysis({ label: 'routine', is_company_news: false, reason: 'Event invitation' }),
    evidence: [resultsFiling],
  }
  render(<CompanyPostRow post={post} />)
  expect(screen.getByText('Routine')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /8-K · Items 2\.02, 9\.01/ })).toBeInTheDocument()
})

test('a payload from before labels falls back to the model decision, never Material', () => {
  const legacy = { ...analysis(), label: undefined }
  render(<CompanyPostRow post={{ ...companyPost('1'), analysis: legacy }} />)
  expect(screen.getByText('Company news')).toBeInTheDocument()
  cleanup()
  const routine = { ...analysis({ is_company_news: false }), label: undefined }
  render(<CompanyPostRow post={{ ...companyPost('2'), analysis: routine }} />)
  expect(screen.getByText('Routine')).toBeInTheDocument()
})

test('uncertain analysis has a reason and no numeric zero placeholder', () => {
  const post = {
    ...companyPost('1'),
    analysis: analysis({
      status: 'uncertain',
      label: null,
      importance_score: null,
      is_company_news: null,
      reason: 'Missing contract scale',
      needs_review: true,
    }),
  }
  render(<CompanyPostRow post={post} />)
  expect(screen.getByText('Needs review')).toBeInTheDocument()
  expect(screen.getByText('Missing contract scale')).toBeInTheDocument()
  expect(screen.queryByText(/0\/100/)).not.toBeInTheDocument()
})

test('a post without analysis shows no AI badge but keeps its filing evidence', () => {
  const post = { ...companyPost('1'), analysis: null, evidence: [resultsFiling] }
  render(<CompanyPostRow post={post} />)
  expect(screen.queryByText('AI unavailable')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /8-K · Items 2\.02, 9\.01/ })).toBeInTheDocument()
})
