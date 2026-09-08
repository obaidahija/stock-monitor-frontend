import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  createManualCommitmentCandidate,
  getCommitmentCandidates,
  reviewCommitmentCandidate,
} from '@/api/management-commitments'
import { renderWithProviders } from '@/test/render'
import type {
  CandidateOut,
  CandidateProposal,
  CommitmentSummaryOut,
} from '@/types/management-commitments'
import { CandidateReview } from './candidate-review'

vi.mock('@/api/management-commitments', () => ({
  getCommitmentCandidates: vi.fn(),
  createManualCommitmentCandidate: vi.fn(),
  reviewCommitmentCandidate: vi.fn(),
  getCommitments: vi.fn(),
  getCommitment: vi.fn(),
  getCommitmentSources: vi.fn(),
  getCommitmentSource: vi.fn(),
  checkCommitmentSources: vi.fn(),
  loadCommitmentSource: vi.fn(),
  extractCommitmentSource: vi.fn(),
  appendCommitmentEvent: vi.fn(),
  archiveCommitment: vi.fn(),
}))

const QUOTE = 'revenue of $100 million to $110 million'

const proposal = (overrides: Partial<CandidateProposal> = {}): CandidateProposal => ({
  kind: 'issued',
  metric: 'revenue',
  basis: 'gaap',
  scope: 'consolidated',
  currency: 'USD',
  unit: 'currency',
  period_start: '2026-02-01',
  period_end: '2027-01-31',
  period_kind: 'year',
  fiscal_label: 'FY27',
  definition: '',
  statement_date: '2026-02-25',
  target: { operator: 'range', lower: '100000000', upper: '110000000' },
  actual_value: null,
  actual_basis: null,
  actual_definition: null,
  evidence: [{ block_id: 'b0001', start: 22, end: 22 + QUOTE.length, quote: QUOTE }],
  model_note: null,
  ...overrides,
})

const candidate = (overrides: Partial<CandidateOut> = {}): CandidateOut => ({
  id: 5,
  document_id: 11,
  extraction_id: 3,
  origin: 'model',
  state: 'pending',
  proposal: proposal(),
  unresolved: [],
  suggested_commitment_ids: [],
  accepted_event_id: null,
  accepted_commitment_id: null,
  review_note: null,
  review_mode: null,
  review_version: null,
  created_at: '2026-09-01T12:00:00Z',
  reviewed_at: null,
  ...overrides,
})

const commitment: CommitmentSummaryOut = {
  id: 7,
  ticker: 'ACME',
  identity: {
    metric: 'revenue',
    basis: 'gaap',
    scope: 'consolidated',
    currency: 'USD',
    unit: 'currency',
    period_start: '2026-02-01',
    period_end: '2027-01-31',
    period_kind: 'year',
    fiscal_label: 'FY27',
    definition: '',
  },
  version: 4,
  archived: false,
  archive_reason: null,
  related_commitment_id: null,
  projection: {
    status: 'open',
    as_of: '2026-09-01',
    original: null,
    latest: null,
    actual: null,
    original_comparison: null,
    latest_comparison: null,
    withdrawn: false,
    withdrawn_event_id: null,
    revision_count: 0,
    reaffirmation_count: 0,
    effective_event_ids: [],
    superseded_event_ids: [],
    notices: [],
  },
  event_count: 1,
  created_at: '2026-09-01T12:00:00Z',
  updated_at: null,
}

function renderReview(items: CandidateOut[], manualEntry = null as never) {
  vi.mocked(getCommitmentCandidates).mockResolvedValue({
    items,
    total: items.length,
    pending_count: items.length,
    offset: 0,
    limit: 50,
  })
  return renderWithProviders(
    <CandidateReview
      ticker="ACME"
      commitments={[commitment]}
      manualEntry={manualEntry}
      onManualEntryClosed={() => {}}
    />,
  )
}

beforeEach(() => {
  vi.mocked(reviewCommitmentCandidate).mockResolvedValue({
    candidate: candidate({ state: 'accepted' }),
    commitment: null,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('the source quote is shown beside the editable fields', async () => {
  renderReview([candidate()])
  expect(await screen.findByText(`“${QUOTE}”`)).toBeInTheDocument()
  expect(screen.getByLabelText('Fiscal period end')).toHaveValue('2027-01-31')
  expect(screen.getByText('Proposed by model')).toBeInTheDocument()
})

test('an empty queue says so rather than showing a blank panel', async () => {
  renderReview([])
  expect(await screen.findByText(/No proposals are waiting/i)).toBeInTheDocument()
})

test('an unresolved proposal cannot be accepted and names what is missing', async () => {
  renderReview([
    candidate({
      proposal: proposal({ period_end: null, period_kind: null }),
      unresolved: ['period_end', 'period_kind'],
    }),
  ])
  await screen.findByText('Incomplete')
  expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
  const alert = screen.getByText(/cannot be accepted until these are supplied/i)
  expect(alert.textContent).toContain('Fiscal period end')
  expect(alert.textContent).toContain('Period type')
})

test('accepting a clean proposal posts a request id and no proposal override', async () => {
  renderReview([candidate()])
  await userEvent.click(await screen.findByRole('button', { name: 'Accept' }))

  await waitFor(() => expect(reviewCommitmentCandidate).toHaveBeenCalledTimes(1))
  const [, candidateId, body] = vi.mocked(reviewCommitmentCandidate).mock.calls[0]
  expect(candidateId).toBe(5)
  expect(body.action).toBe('accept')
  expect(body.request_uuid).toBeTruthy()
  expect(body.commitment_id).toBeNull()
  expect(body.proposal).toBeNull()
})

test('editing a model field requires a review note before acceptance', async () => {
  renderReview([candidate()])
  const currency = await screen.findByLabelText('Currency')
  await userEvent.clear(currency)
  await userEvent.type(currency, 'EUR')

  expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled()
  expect(screen.getByText(/required — you changed a proposed field/i)).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText(/Review note/i), 'currency corrected from source')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled(),
  )
})

test('an edited proposal is sent back with the acceptance', async () => {
  renderReview([candidate()])
  const currency = await screen.findByLabelText('Currency')
  await userEvent.clear(currency)
  await userEvent.type(currency, 'EUR')
  await userEvent.type(screen.getByLabelText(/Review note/i), 'corrected')
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

  await waitFor(() => expect(reviewCommitmentCandidate).toHaveBeenCalledTimes(1))
  const body = vi.mocked(reviewCommitmentCandidate).mock.calls[0][2]
  expect(body.proposal?.currency).toBe('EUR')
  expect(body.note).toBe('corrected')
})

test('attaching to an existing commitment sends its current version', async () => {
  renderReview([candidate({ suggested_commitment_ids: [7] })])
  await screen.findByRole('button', { name: 'Accept' })
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

  await waitFor(() => expect(reviewCommitmentCandidate).toHaveBeenCalledTimes(1))
  const body = vi.mocked(reviewCommitmentCandidate).mock.calls[0][2]
  expect(body.commitment_id).toBe(7)
  expect(body.expected_version).toBe(4)
})

test('rejecting posts a reject action', async () => {
  renderReview([candidate()])
  await userEvent.click(await screen.findByRole('button', { name: 'Reject' }))
  await waitFor(() => expect(reviewCommitmentCandidate).toHaveBeenCalledTimes(1))
  expect(vi.mocked(reviewCommitmentCandidate).mock.calls[0][2].action).toBe('reject')
})

test('a 409 explains the conflict and keeps unsaved input', async () => {
  const { ApiError } = await import('@/lib/api-client')
  vi.mocked(reviewCommitmentCandidate).mockRejectedValue(
    new ApiError(409, { code: 'stale_version', current_version: 5 }),
  )
  renderReview([candidate()])
  const note = await screen.findByLabelText(/Review note/i)
  await userEvent.type(note, 'my working note')
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

  expect(await screen.findByText(/changed while you were reviewing/i)).toBeInTheDocument()
  expect(note).toHaveValue('my working note')
})

test('manual entry rejects wording that is not in the selected passage', async () => {
  renderReview(
    [],
    {
      documentId: 11,
      blocks: [
        {
          block_id: 'b0001',
          order: 1,
          kind: 'paragraph',
          text: `We expect fiscal 2027 ${QUOTE}.`,
          headers: [],
        },
      ],
    } as never,
  )
  const quoteField = await screen.findByLabelText(/Exact quotation/i)
  await userEvent.type(quoteField, 'revenue of $900 million')

  expect(await screen.findByText(/does not appear in the selected passage/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Save for review/i })).toBeDisabled()
  expect(createManualCommitmentCandidate).not.toHaveBeenCalled()
})

test('manual entry computes the span from the passage and never defaults dates', async () => {
  vi.mocked(createManualCommitmentCandidate).mockResolvedValue(candidate({ origin: 'manual' }))
  const text = `We expect fiscal 2027 ${QUOTE}.`
  renderReview(
    [],
    {
      documentId: 11,
      blocks: [{ block_id: 'b0001', order: 1, kind: 'paragraph', text, headers: [] }],
    } as never,
  )

  // Dates start empty: a filing date is not a fiscal period end, and
  // pre-filling one would look like evidence.
  expect(await screen.findByLabelText('Fiscal period end')).toHaveValue('')

  await userEvent.type(screen.getByLabelText(/Exact quotation/i), QUOTE)
  await userEvent.type(screen.getByLabelText('Fiscal period start'), '2026-02-01')
  await userEvent.type(screen.getByLabelText('Fiscal period end'), '2027-01-31')
  await userEvent.type(screen.getByLabelText('Statement date'), '2026-02-25')
  await userEvent.type(screen.getByLabelText('Currency'), 'USD')
  await userEvent.type(screen.getByLabelText('Lower bound'), '100000000')
  await userEvent.type(screen.getByLabelText('Upper bound'), '110000000')

  const periodType = screen.getByLabelText('Period type')
  await userEvent.click(periodType)
  await userEvent.click(await screen.findByRole('option', { name: 'Year' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Save for review/i })).toBeEnabled(),
  )
  await userEvent.click(screen.getByRole('button', { name: /Save for review/i }))

  await waitFor(() => expect(createManualCommitmentCandidate).toHaveBeenCalledTimes(1))
  const body = vi.mocked(createManualCommitmentCandidate).mock.calls[0][1]
  const evidence = body.proposal.evidence[0]
  expect(evidence.quote).toBe(QUOTE)
  expect(text.slice(evidence.start, evidence.end)).toBe(QUOTE)
})

test('the origin of a manual candidate stays visible', async () => {
  renderReview([candidate({ origin: 'manual' })])
  expect(await screen.findByText('Entered manually')).toBeInTheDocument()
})

test('manual result entry sends an actual without the initial empty target', async () => {
  const quote = 'full year revenue was $93 million'
  vi.mocked(createManualCommitmentCandidate).mockResolvedValue(candidate({ origin: 'manual' }))
  renderReview([], {
    documentId: 13,
    blocks: [{ block_id: 'b0001', order: 0, kind: 'paragraph', text: quote, headers: [] }],
  } as never)
  await userEvent.type(await screen.findByLabelText(/Exact quotation/i), quote)
  await userEvent.click(screen.getByLabelText('Statement kind'))
  await userEvent.click(await screen.findByRole('option', { name: 'Result reported' }))
  await userEvent.type(screen.getByLabelText('Fiscal period start'), '2026-02-01')
  await userEvent.type(screen.getByLabelText('Fiscal period end'), '2027-01-31')
  await userEvent.type(screen.getByLabelText('Statement date'), '2027-02-24')
  await userEvent.type(screen.getByLabelText('Currency'), 'USD')
  await userEvent.click(screen.getByLabelText('Period type'))
  await userEvent.click(await screen.findByRole('option', { name: 'Year' }))
  await userEvent.type(screen.getByLabelText('Reported result'), '93000000')
  await userEvent.click(screen.getByRole('button', { name: 'Save for review' }))
  await waitFor(() => expect(createManualCommitmentCandidate).toHaveBeenCalledTimes(1))
  expect(vi.mocked(createManualCommitmentCandidate).mock.calls[0][1].proposal).toMatchObject({
    kind: 'actual', target: null, actual_value: '93000000',
  })
})

test('switching from a reported result back to guidance clears actual-only fields', async () => {
  renderReview([candidate({ origin: 'manual', proposal: proposal({
    kind: 'actual', target: null, actual_value: '93000000', actual_basis: 'gaap',
    actual_definition: 'previous result definition',
  }) })])
  await userEvent.click(await screen.findByLabelText('Statement kind'))
  await userEvent.click(await screen.findByRole('option', { name: 'Guidance issued' }))
  await userEvent.type(screen.getByLabelText('Lower bound'), '100000000')
  await userEvent.type(screen.getByLabelText('Upper bound'), '110000000')
  await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
  await waitFor(() => expect(reviewCommitmentCandidate).toHaveBeenCalledTimes(1))
  expect(vi.mocked(reviewCommitmentCandidate).mock.calls[0][2].proposal).toMatchObject({
    kind: 'issued', actual_value: null, actual_basis: null, actual_definition: null,
    target: { operator: 'range', lower: '100000000', upper: '110000000' },
  })
})

test('a large target keeps every digit through the form', async () => {
  const big = '9007199254740993'
  renderReview([
    candidate({ proposal: proposal({ target: { operator: 'range', lower: big, upper: big } }) }),
  ])
  const lower = await screen.findByLabelText('Lower bound')
  expect(lower).toHaveValue(big)
  expect(within(document.body).queryByDisplayValue('9007199254740992')).toBeNull()
})
