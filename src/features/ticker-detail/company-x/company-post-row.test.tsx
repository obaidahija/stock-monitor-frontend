import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { CompanyPostRow } from './company-post-row'
import { companyPost } from './test-fixtures'

afterEach(cleanup)
test('shows importance and reason while retaining original content', () => {
  const post = { ...companyPost('1'), analysis: { status: 'completed' as const, importance_score: 72, is_company_news: true, reason: 'New product release', needs_review: false, analysed_at: null } }
  render(<CompanyPostRow post={post} />)
  expect(screen.getByText('AI importance 72/100')).toBeInTheDocument()
  expect(screen.getByText('New product release')).toBeInTheDocument()
  expect(screen.getByText(post.text)).toBeInTheDocument()
})
test('uncertain analysis has a reason and no numeric zero placeholder', () => {
  const post = { ...companyPost('1'), analysis: { status: 'uncertain' as const, importance_score: null, is_company_news: null, reason: 'Missing contract scale', needs_review: true, analysed_at: null } }
  render(<CompanyPostRow post={post} />)
  expect(screen.getByText('Needs review')).toBeInTheDocument()
  expect(screen.getByText('Missing contract scale')).toBeInTheDocument()
  expect(screen.queryByText(/0\/100/)).not.toBeInTheDocument()
})
