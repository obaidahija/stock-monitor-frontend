import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { EvidencePanel } from './evidence-panel'
import { history, metric } from '../fundamentals/test-fixtures'

afterEach(cleanup)

const oldInputs = {
  news_item_ids: [], news_item_count: 0, twitter_post_ids: [], twitter_post_count: 0,
  twitter_cache_is_fresh: false, twitter_cache_age_seconds: null,
  reddit_post_ids: [], reddit_post_count: 0, reddit_cache_is_fresh: false,
  reddit_cache_age_seconds: null, quant_facts: [],
}

test('older saved reports explicitly lack SEC context', () => {
  render(<EvidencePanel inputsUsed={oldInputs} />)
  expect(screen.getByText('This saved report has no SEC financial context.')).toBeInTheDocument()
})

test('saved SEC evidence displays its pinned identity and exact model context without loading current history', () => {
  const saved = history()
  render(<EvidencePanel inputsUsed={{ ...oldInputs, sec_fundamentals: {
    snapshot_id: 7, publication_id: 9, cutoff: '2026-10-27T13:00:00Z',
    context: 'SEC Company Facts: selected revenue and cash-flow evidence.',
    quality: saved.quality, selected_periods: saved.periods,
  } } as never} />)
  expect(screen.getByText(/Snapshot 7 · publication 9/)).toBeInTheDocument()
  expect(screen.getByText('SEC Company Facts: selected revenue and cash-flow evidence.')).toBeInTheDocument()
  expect(screen.getByText('$9,007,199,254,740,993.12')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /10-Q · filed 2026-08-05/ }).length).toBeGreaterThan(0)
})

test('renders Reddit evidence separately from Twitter', () => {
  render(
    <EvidencePanel
      inputsUsed={{
        news_item_ids: [],
        news_item_count: 1,
        twitter_post_ids: ['tweet-1'],
        twitter_post_count: 1,
        twitter_cache_is_fresh: true,
        twitter_cache_age_seconds: 30,
        reddit_post_ids: ['reddit-1', 'reddit-2'],
        reddit_post_count: 2,
        reddit_cache_is_fresh: false,
        reddit_cache_age_seconds: 90,
        quant_facts: [],
      }}
    />,
  )

  expect(screen.getByText('2 Reddit posts')).toBeInTheDocument()
  expect(screen.getByText('Reddit cache stale (90s old)')).toBeInTheDocument()
  expect(screen.getByText('1 X/Twitter post')).toBeInTheDocument()
})

test('omitted SEC inputs are distinct from financial facts explicitly marked unavailable', () => {
  const latest = history().periods[0]
  render(<EvidencePanel inputsUsed={{ ...oldInputs, sec_fundamentals: {
    snapshot_id: 7, publication_id: 9, cutoff: '2026-10-27T13:00:00Z',
    context: 'Selected facts only; omitted history does not imply missing financial data.',
    quality: { status: 'partial', reasons: [] },
    selected_periods: [
      { ...latest, metrics: { revenue: metric('100'), cash: metric('10'), net_income: metric('5') } },
      { ...latest, period_start: '2025-04-01', period_end: '2025-06-30', fiscal_label: 'FY2025 Q2',
        metrics: { revenue: metric('90'), net_income: metric(null, { sources: [], reasons: ['missing_fact'] }) } },
    ],
  } }} />)

  const cash = within(screen.getByText('Cash').closest('tr')!).getAllByRole('cell', { hidden: true })
  expect(cash[2]).toHaveTextContent('Not included in report inputs')
  expect(cash[2]).not.toHaveTextContent('Unavailable')
  expect(cash[2]).not.toHaveTextContent('No comparable source fact')
  const income = within(screen.getByText('Net income').closest('tr')!).getAllByRole('cell', { hidden: true })
  expect(income[2]).toHaveTextContent('Unavailable')
  expect(income[2]).toHaveTextContent('Missing fact')
})
