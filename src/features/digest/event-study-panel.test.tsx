import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { getEventStudyProgress, getEventStudy, getHistoricalEventFacts, getFilingEstimate, analyzeFiling, downloadEventStudy } from '@/api/event-study'
import { EventStudyPanel } from './event-study-panel'
import type { EventStudy, StudyModelMetrics } from './event-study-types'

vi.mock('@/api/event-study', () => ({ getEventStudyProgress: vi.fn(), getEventStudy: vi.fn(), getHistoricalEventFacts: vi.fn(), getFilingEstimate: vi.fn(), analyzeFiling: vi.fn(), downloadEventStudy: vi.fn() }))
const metrics: StudyModelMetrics = { accuracy: .444, balanced_accuracy: .333, macro_f1: .319, class_support: { up: 8, down: 8, flat: 2 }, confusion_matrix: [[5,0,3],[1,0,1],[4,1,3]], cost_sensitivity: Object.fromEntries(['20','50','100'].map((cost) => [cost, { signals: 17, mean_net_return_pct: 1.26, win_fraction: .53 }])) }
const study: EventStudy = { study_id: 'reviewed', status: 'experimental_unvalidated', evaluation_status: 'exploratory_previously_inspected_test_period', generated_at: '2026-10-06T20:00:00Z', start: '2026-07-13', end: '2026-10-05', stock_count: 50, outcome_count: 496, tickers: ['NTAP'], horizons: [1,3,5].map((horizon) => ({ horizon, selected_model: 'deterministic_gradient_boosting', split_counts: { train: 82, validation: 9, test: horizon === 3 ? 35 : 18, purged: 33 }, models: { deterministic_gradient_boosting: metrics, majority: metrics } })), audit: { original_retained_facts: 57, retained_after_checks_and_review: 42, review_verdicts: {} }, limitations: ['Small historical sample'], confirmation: 'No untouched confirmation', label_definition: 'Up above +1%', entry_definition: 'Next open' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getEventStudyProgress).mockResolvedValue({ status: "extracting", stocks: 50, completed: 522, total: 2286 })
  vi.mocked(getEventStudy).mockResolvedValue(study)
  vi.mocked(getHistoricalEventFacts).mockResolvedValue([])
  vi.mocked(getFilingEstimate).mockResolvedValue({ ticker: 'NTAP', status: 'not_started', facts: [], rule_facts: [], estimates: [], warnings: [], retrospective: false, preliminary: false })
})
afterEach(cleanup)

test('shows study scope and compares horizons with exploratory disclosure', async () => {
  const user = userEvent.setup()
  renderWithProviders(<EventStudyPanel tickers={['NTAP']} />)
  expect(await screen.findByText(/50 selected tickers · 496 outcomes/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Historical results' }))
  expect(screen.getAllByText(/No untouched confirmation/).length).toBeGreaterThan(0)
  expect(screen.getByText(/522 \/ 2286 events/)).toBeInTheDocument()
  expect(screen.getByLabelText('Outcome horizon')).toHaveValue('5')
  await user.selectOptions(screen.getByLabelText('Outcome horizon'), '3')
  expect(screen.getByText(/35 test/)).toBeInTheDocument()
  expect(analyzeFiling).not.toHaveBeenCalled()
})

test('selecting a ticker reads saved analysis but does not start inference', async () => {
  const user = userEvent.setup()
  renderWithProviders(<EventStudyPanel tickers={['NTAP']} />)
  await screen.findByRole('button', { name: 'Select ticker' })
  await user.type(screen.getByLabelText('Ticker'), 'ntap')
  await user.click(screen.getByRole('button', { name: 'Select ticker' }))
  await screen.findByRole('button', { name: 'Analyze filing' })
  expect(getFilingEstimate).toHaveBeenCalledWith('NTAP', undefined)
  expect(analyzeFiling).not.toHaveBeenCalled()
})

test('study artifacts download requires an explicit click', async () => {
  const user = userEvent.setup()
  renderWithProviders(<EventStudyPanel tickers={[]} />)
  await screen.findByRole('button', { name: 'Download study and model artifacts' })
  expect(downloadEventStudy).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Download study and model artifacts' }))
  expect(downloadEventStudy).toHaveBeenCalledTimes(1)
})
