import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { CommitmentTimeline } from './commitment-timeline'
import {
  ACTUAL_QUOTE,
  ORIGINAL_QUOTE,
  REVISED_QUOTE,
  event,
  revisedRevenueFixture,
  withProjection,
} from './fixtures'

vi.mock('@/api/management-commitments', () => ({
  getCommitment: vi.fn(),
  getCommitments: vi.fn(),
  getCommitmentSources: vi.fn(),
  getCommitmentSource: vi.fn(),
  getCommitmentCandidates: vi.fn(),
  checkCommitmentSources: vi.fn(),
  loadCommitmentSource: vi.fn(),
  extractCommitmentSource: vi.fn(),
  createManualCommitmentCandidate: vi.fn(),
  reviewCommitmentCandidate: vi.fn(),
  appendCommitmentEvent: vi.fn(),
  archiveCommitment: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function render(commitment = revisedRevenueFixture) {
  return renderWithProviders(<CommitmentTimeline ticker="ACME" commitment={commitment} />)
}

test('shows both benchmarks without calling a revised target the original', () => {
  render()
  expect(screen.getByText('Original target')).toBeInTheDocument()
  expect(screen.getByText('Latest target')).toBeInTheDocument()
  expect(screen.getByText('Below original target')).toBeInTheDocument()
  expect(screen.getByText('Met latest target')).toBeInTheDocument()
})

test('amounts above the safe integer range stay exact', () => {
  const big = '9007199254740993'
  render(
    withProjection({
      original: {
        ...revisedRevenueFixture.projection.original!,
        target: { operator: 'range', lower: big, upper: '9007199254740994' },
      },
    }),
  )
  // Grouped for readability but digit-for-digit identical to what the API sent.
  expect(screen.getByText(/USD 9,007,199,254,740,993/)).toBeInTheDocument()
  expect(screen.queryByText(/9,007,199,254,740,992/)).toBeNull()
})

test('the original and revised figures are both shown, not just the one that was met', () => {
  render()
  // Each figure appears twice by design: once as a benchmark, once in history.
  expect(screen.getAllByText(/USD 100,000,000 to USD 110,000,000/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/USD 90,000,000 to USD 95,000,000/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/USD 93,000,000/).length).toBeGreaterThan(0)
})

test('history shows statement date and recorded time separately', () => {
  render()
  const history = screen.getByTestId('event-history')
  expect(history.textContent).toMatch(/Stated .* · recorded /)
})

test('every recorded statement carries its source quote', () => {
  render()
  const history = screen.getByTestId('event-history')
  expect(history.textContent).toContain(ORIGINAL_QUOTE)
  expect(history.textContent).toContain(REVISED_QUOTE)
  expect(history.textContent).toContain(ACTUAL_QUOTE)
})

test('a correction keeps the superseded record visible with its old value', () => {
  const corrected = event({
    id: 4,
    kind: 'correction',
    supersedes_event_id: 1,
    note: 'upper bound was transcribed as 110 instead of 115',
    payload: {
      kind: 'issued',
      statement_date: '2026-02-25',
      evidence: revisedRevenueFixture.events[0].payload.evidence,
      target: { operator: 'range', lower: '100000000', upper: '115000000' },
      actual_value: null,
      actual_basis: null,
      actual_definition: null,
      note: null,
    },
  })
  const superseded = {
    ...revisedRevenueFixture.events[0],
    superseded_by_event_id: 4,
  }
  render(
    withProjection(
      { superseded_event_ids: [1] },
      {
        events: [corrected, revisedRevenueFixture.events[1], revisedRevenueFixture.events[2]],
        superseded_events: [superseded],
      },
    ),
  )

  expect(screen.getByText('Superseded records')).toBeInTheDocument()
  const supersededList = screen.getByTestId('superseded-history')
  expect(supersededList.textContent).toContain('110,000,000')
  expect(screen.getByText(/replaces record #1/)).toBeInTheDocument()
  expect(screen.getByText(/Note: upper bound was transcribed/)).toBeInTheDocument()
})

test('a withdrawal is shown as guidance closed, with the original still comparable', () => {
  render(
    withProjection({
      status: 'resolved',
      withdrawn: true,
      withdrawn_event_id: 2,
      latest: null,
      latest_comparison: null,
      notices: ['guidance_withdrawn'],
    }),
  )
  // The badge and the empty latest-target slot both say so.
  expect(screen.getAllByText('Withdrawn').length).toBeGreaterThan(0)
  expect(screen.getByText('Below original target')).toBeInTheDocument()
  expect(screen.queryByText('Met latest target')).toBeNull()
  expect(screen.getByText(/Guidance was withdrawn before the result/i)).toBeInTheDocument()
})

test('a past period with no result says awaiting, never a missed commitment', () => {
  render(
    withProjection({
      status: 'awaiting_result',
      actual: null,
      original_comparison: null,
      latest_comparison: null,
    }),
  )
  expect(screen.getByText('Awaiting result')).toBeInTheDocument()
  expect(screen.getByText(/no comparable result has been recorded yet/i)).toBeInTheDocument()
  expect(screen.queryByText(/missed/i)).toBeNull()
  expect(screen.queryByText(/Below original target/)).toBeNull()
})

test('an incomparable actual is labelled as such, not as a miss', () => {
  render(
    withProjection({
      status: 'needs_review',
      original_comparison: {
        outcome: 'not_comparable',
        target: revisedRevenueFixture.projection.original!.target,
        target_event_id: 1,
        actual_value: '93000000',
        actual_event_id: 3,
        reason: 'definition_mismatch',
      },
      latest_comparison: null,
      notices: ['actual_definition_mismatch'],
    }),
  )
  expect(screen.getByText('Not comparable to original target')).toBeInTheDocument()
  expect(screen.getByText(/different adjustment definition/i)).toBeInTheDocument()
  expect(screen.queryByText('Below original target')).toBeNull()
})

test('conflicting actuals surface as review, not as a verdict', () => {
  render(
    withProjection({
      status: 'needs_review',
      actual: null,
      original_comparison: null,
      latest_comparison: null,
      notices: ['conflicting_actuals'],
    }),
  )
  expect(screen.getByText('Needs review')).toBeInTheDocument()
  expect(screen.getByText(/More than one reported result/i)).toBeInTheDocument()
})

test('an archived commitment keeps its history and shows the reason', () => {
  render(
    withProjection({}, { archived: true, archive_reason: 'entered against the wrong issuer' }),
  )
  expect(screen.getByText('Archived')).toBeInTheDocument()
  expect(screen.getByText(/entered against the wrong issuer/)).toBeInTheDocument()
  expect(screen.getByText(/History is preserved/)).toBeInTheDocument()
  expect(screen.getByTestId('event-history').children.length).toBe(3)
})

test('a negative margin target renders with its sign intact', () => {
  render(
    withProjection(
      {
        original: {
          ...revisedRevenueFixture.projection.original!,
          target: { operator: 'range', lower: '-2', upper: '1' },
        },
        latest: null,
        latest_comparison: null,
      },
      {
        identity: {
          ...revisedRevenueFixture.identity,
          metric: 'operating_margin',
          currency: null,
          unit: 'percentage_points',
        },
      },
    ),
  )
  expect(screen.getByText('-2% to 1%')).toBeInTheDocument()
})

test('a ceiling that was blown through reads as above limit, not exceeded', () => {
  render(
    withProjection({
      original: {
        ...revisedRevenueFixture.projection.original!,
        target: { operator: 'lte', lower: null, upper: '25000000' },
      },
      original_comparison: {
        outcome: 'above_limit',
        target: { operator: 'lte', lower: null, upper: '25000000' },
        target_event_id: 1,
        actual_value: '26000000',
        actual_event_id: 3,
        reason: null,
      },
      latest: null,
      latest_comparison: null,
    }),
  )
  expect(screen.getByText('Above limit original target')).toBeInTheDocument()
  expect(screen.getByText(/no more than USD 25,000,000/)).toBeInTheDocument()
})

test('the origin of each record stays visible', () => {
  render(
    withProjection({}, { events: [{ ...revisedRevenueFixture.events[0], origin: 'model' }] }),
  )
  expect(screen.getByText('From a model proposal')).toBeInTheDocument()
})
