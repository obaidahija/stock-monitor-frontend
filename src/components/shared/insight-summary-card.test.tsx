import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { InsightSummaryOut } from '@/types/insight-summary'
import { InsightSummaryCard } from './insight-summary-card'

afterEach(cleanup)


function summary(overrides: Partial<InsightSummaryOut> = {}): InsightSummaryOut {
  return {
    status: 'ready',
    signal: 'positive',
    confidence: 'high',
    headline: 'Guidance improved',
    explanation: 'Revenue guidance increased while the latest result met the range.',
    key_positives: [
      {
        id: 'p1',
        polarity: 'positive',
        materiality: 'high',
        title: 'Revenue guidance was raised',
        detail: 'The range moved higher.',
        evidence_refs: [],
      },
    ],
    key_negatives: [],
    key_neutral: [],
    key_facts: [{ label: 'Revenue · FY27', value: 'USD 100m–110m', context: null }],
    coverage: { status: 'complete', included: ['Accepted guidance'], excluded: [], notices: [] },
    generated_at: '2026-09-07T12:00:00Z',
    stale: false,
    analysis_version: 'test-v1',
    usage: null,
    ...overrides,
  }
}


test.each(['positive', 'negative', 'neutral', 'mixed'] as const)(
  'renders %s as text and an accessible signal label',
  (signal) => {
    render(
      <InsightSummaryCard
        title="Annual filing changes"
        summary={summary({ signal })}
        isRefreshing={false}
        refreshError={null}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText(new RegExp(signal, 'i'))).toBeInTheDocument()
    expect(screen.getByLabelText(new RegExp(`Business impact: ${signal}`, 'i'))).toBeInTheDocument()
  },
)

test('unavailable is distinct from neutral and invites refresh', () => {
  render(
    <InsightSummaryCard
      title="Management commitments"
      summary={summary({ status: 'unavailable', signal: null, confidence: null })}
      isRefreshing={false}
      refreshError={null}
      onRefresh={vi.fn()}
    />,
  )
  expect(screen.getByText('Unavailable')).toBeInTheDocument()
  expect(screen.queryByLabelText(/Business impact: neutral/i)).not.toBeInTheDocument()
})

test('shows confidence, three key factors, facts, and coverage gaps', () => {
  const factors = Array.from({ length: 4 }, (_, index) => ({
    id: `n${index}`,
    polarity: 'negative' as const,
    materiality: 'high' as const,
    title: `Factor ${index + 1}`,
    detail: `Detail ${index + 1}`,
    evidence_refs: [],
  }))
  render(
    <InsightSummaryCard
      title="Annual filing changes"
      summary={summary({
        confidence: 'medium',
        key_positives: [],
        key_negatives: factors,
        coverage: { status: 'partial', included: ['Risk Factors'], excluded: ['MD&A'], notices: [] },
      })}
      isRefreshing={false}
      refreshError={null}
      onRefresh={vi.fn()}
    />,
  )
  expect(screen.getByText(/Medium confidence/i)).toBeInTheDocument()
  expect(screen.getByText('Factor 3')).toBeInTheDocument()
  expect(screen.queryByText('Factor 4')).not.toBeInTheDocument()
  expect(screen.getByText('USD 100m–110m')).toBeInTheDocument()
  expect(screen.getByText(/Not covered: MD&A/i)).toBeInTheDocument()
})

test('shows stale and retryable errors without hiding the saved result', () => {
  render(
    <InsightSummaryCard
      title="Annual filing changes"
      summary={summary({ stale: true })}
      isRefreshing={false}
      refreshError={new Error('Network down')}
      onRefresh={vi.fn()}
    />,
  )
  expect(screen.getByText(/saved result may be out of date/i)).toBeInTheDocument()
  expect(screen.getByText(/Network down/i)).toBeInTheDocument()
  expect(screen.getByText('Guidance improved')).toBeInTheDocument()
})

test('refresh button is disabled while working and invokes one callback', async () => {
  const onRefresh = vi.fn()
  const { rerender } = render(
    <InsightSummaryCard
      title="Management commitments"
      summary={null}
      isRefreshing={false}
      refreshError={null}
      onRefresh={onRefresh}
    />,
  )
  expect(screen.getByText(/No saved summary/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Refresh analysis/i }))
  expect(onRefresh).toHaveBeenCalledTimes(1)

  rerender(
    <InsightSummaryCard
      title="Management commitments"
      summary={null}
      isRefreshing
      refreshError={null}
      onRefresh={onRefresh}
    />,
  )
  expect(screen.getByRole('button', { name: /Refreshing analysis/i })).toBeDisabled()
})

test('ordinary React escaping renders source text as text', () => {
  render(
    <InsightSummaryCard
      title="Annual filing changes"
      summary={summary({ headline: '<script>alert(1)</script>' })}
      isRefreshing={false}
      refreshError={null}
      onRefresh={vi.fn()}
    />,
  )
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
  expect(screen.getByText(/not a buy\/sell recommendation/i)).toBeInTheDocument()
})
