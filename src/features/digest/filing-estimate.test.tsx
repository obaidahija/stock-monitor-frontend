import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { analyzeFiling, getFilingEstimate } from '@/api/event-study'
import { EstimateResult, FilingEstimatePanel } from './filing-estimate'
import type { FilingEstimate } from './event-study-types'

vi.mock('@/api/event-study', () => ({ getFilingEstimate: vi.fn(), analyzeFiling: vi.fn() }))

const complete: FilingEstimate = {
  ticker: 'NTAP', status: 'complete', preliminary: false, retrospective: true,
  public_at: '2026-09-24T20:30:00Z', entry_session: '2026-09-25',
  filing_url: 'https://www.sec.gov/example', feature_last_session: '2026-09-24',
  facts: [{ category: 'guidance_raised', quote: 'The company raised revenue guidance.' }],
  rule_facts: [], warnings: ['No untouched validation has been completed.'],
  estimates: [{ horizon: 3, direction: 'up', probabilities: { up: .61, down: .22, flat: .17 },
    model: 'full_logistic', overlaps_training_period: false, status: 'experimental_unvalidated', test_events: 35 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getFilingEstimate).mockResolvedValue({ ticker: 'NTAP', status: 'not_started', facts: [], rule_facts: [], warnings: [], estimates: [], preliminary: false, retrospective: false })
  vi.mocked(analyzeFiling).mockResolvedValue(complete)
})
afterEach(cleanup)

test('compact filing control does no analysis until requested and uses displayed filing', async () => {
  const user = userEvent.setup()
  renderWithProviders(<FilingEstimatePanel ticker="NTAP" filingUrl="https://www.sec.gov/displayed" compact />)
  expect(getFilingEstimate).not.toHaveBeenCalled()
  expect(analyzeFiling).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Experimental filing direction' }))
  await screen.findByRole('button', { name: 'Analyze filing' })
  expect(getFilingEstimate).toHaveBeenCalledWith('NTAP', 'https://www.sec.gov/displayed')
  await user.click(screen.getByRole('button', { name: 'Analyze filing' }))
  expect(analyzeFiling).toHaveBeenCalledWith('NTAP', 'https://www.sec.gov/displayed', false)
  expect(await screen.findByText('61.0%')).toBeInTheDocument()
  expect(screen.getByText(/historical reconstruction/i)).toBeInTheDocument()
  expect(screen.getByText(/model probabilities are unvalidated/i)).toBeInTheDocument()
})

test('pending analysis shows phase and prevents duplicate submissions', async () => {
  const user = userEvent.setup()
  vi.mocked(analyzeFiling).mockResolvedValue({ ...complete, status: 'running', phase: 'Verifying SEC publication', estimates: [] })
  renderWithProviders(<FilingEstimatePanel ticker="NTAP" />)
  await screen.findByRole('button', { name: 'Analyze filing' })
  await user.click(screen.getByRole('button', { name: 'Analyze filing' }))
  expect(await screen.findByText('Verifying SEC publication')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Analyzing…' })).toBeDisabled()
  expect(analyzeFiling).toHaveBeenCalledTimes(1)
})

test('unsafe source links are suppressed and evidence stays text', () => {
  renderWithProviders(<EstimateResult data={{ ...complete, filing_url: 'javascript:alert(1)', facts: [{ category: 'routine', quote: '<img src=x onerror=alert(1)>' }] }} />)
  expect(screen.queryByRole('link', { name: 'Read SEC source' })).not.toBeInTheDocument()
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
})

test('withheld estimates show the reason without a direction or percentage', () => {
  renderWithProviders(<EstimateResult data={{ ...complete, estimates: [{ ...complete.estimates[0], direction: null, probabilities: {}, withheld_reasons: ['No supported economic filing facts were extracted'] }] }} />)
  expect(screen.getByText('No direction estimate')).toBeInTheDocument()
  expect(screen.getByText('No supported economic filing facts were extracted')).toBeInTheDocument()
  expect(screen.queryByText('61.0%')).not.toBeInTheDocument()
  expect(screen.queryByText('up estimate')).not.toBeInTheDocument()
})
