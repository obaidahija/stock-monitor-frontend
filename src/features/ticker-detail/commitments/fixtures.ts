import type {
  CommitmentDetailOut,
  EventOut,
  MetricIdentity,
} from '@/types/management-commitments'

/**
 * The 100–110 → 90–95 → actual 93 case, in the same values the backend
 * integration flow uses. Deliberately not a separate frontend interpretation:
 * if the two drifted apart, a rendering test could pass while showing something
 * the API would never produce.
 */

export const ORIGINAL_QUOTE = 'revenue of $100 million to $110 million'
export const REVISED_QUOTE = 'revenue of $90 million to $95 million'
export const ACTUAL_QUOTE = 'full year revenue was $93 million'

export const FY27_IDENTITY: MetricIdentity = {
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
}

function evidence(documentId: number, quote: string) {
  return {
    document_id: documentId,
    content_hash: 'a'.repeat(64),
    block_id: 'b0001',
    start: 22,
    end: 22 + quote.length,
    quote,
  }
}

export function event(overrides: Partial<EventOut> & Pick<EventOut, 'id'>): EventOut {
  return {
    sequence: overrides.id,
    kind: 'issued',
    payload: {
      kind: 'issued',
      statement_date: '2026-02-25',
      evidence: [evidence(11, ORIGINAL_QUOTE)],
      target: { operator: 'range', lower: '100000000', upper: '110000000' },
      actual_value: null,
      actual_basis: null,
      actual_definition: null,
      note: null,
    },
    supersedes_event_id: null,
    superseded_by_event_id: null,
    note: null,
    origin: 'manual',
    candidate_id: null,
    request_uuid: `req-${overrides.id}`,
    recorded_at: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

const ISSUED = event({ id: 1 })

const REVISED = event({
  id: 2,
  kind: 'revised',
  payload: {
    kind: 'revised',
    statement_date: '2026-08-20',
    evidence: [evidence(12, REVISED_QUOTE)],
    target: { operator: 'range', lower: '90000000', upper: '95000000' },
    actual_value: null,
    actual_basis: null,
    actual_definition: null,
    note: null,
  },
})

const ACTUAL = event({
  id: 3,
  kind: 'actual',
  payload: {
    kind: 'actual',
    statement_date: '2027-02-24',
    evidence: [evidence(13, ACTUAL_QUOTE)],
    target: null,
    actual_value: '93000000',
    actual_basis: 'gaap',
    actual_definition: null,
    note: null,
  },
})

export const revisedRevenueFixture: CommitmentDetailOut = {
  id: 7,
  ticker: 'ACME',
  identity: FY27_IDENTITY,
  version: 3,
  archived: false,
  archive_reason: null,
  related_commitment_id: null,
  projection: {
    status: 'resolved',
    as_of: '2027-03-01',
    original: {
      event_id: 1,
      sequence: 1,
      kind: 'issued',
      statement_date: '2026-02-25',
      target: { operator: 'range', lower: '100000000', upper: '110000000' },
      evidence: [evidence(11, ORIGINAL_QUOTE)],
    },
    latest: {
      event_id: 2,
      sequence: 2,
      kind: 'revised',
      statement_date: '2026-08-20',
      target: { operator: 'range', lower: '90000000', upper: '95000000' },
      evidence: [evidence(12, REVISED_QUOTE)],
    },
    actual: {
      event_id: 3,
      sequence: 3,
      statement_date: '2027-02-24',
      value: '93000000',
      basis: 'gaap',
      definition: '',
      evidence: [evidence(13, ACTUAL_QUOTE)],
    },
    original_comparison: {
      outcome: 'below',
      target: { operator: 'range', lower: '100000000', upper: '110000000' },
      target_event_id: 1,
      actual_value: '93000000',
      actual_event_id: 3,
      reason: null,
    },
    latest_comparison: {
      outcome: 'met',
      target: { operator: 'range', lower: '90000000', upper: '95000000' },
      target_event_id: 2,
      actual_value: '93000000',
      actual_event_id: 3,
      reason: null,
    },
    withdrawn: false,
    withdrawn_event_id: null,
    revision_count: 1,
    reaffirmation_count: 0,
    effective_event_ids: [1, 2, 3],
    superseded_event_ids: [],
    notices: [],
  },
  event_count: 3,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2027-03-01T10:00:00Z',
  events: [ISSUED, REVISED, ACTUAL],
  superseded_events: [],
}

export function withProjection(
  overrides: Partial<CommitmentDetailOut['projection']>,
  commitment: Partial<CommitmentDetailOut> = {},
): CommitmentDetailOut {
  return {
    ...revisedRevenueFixture,
    ...commitment,
    projection: { ...revisedRevenueFixture.projection, ...overrides },
  }
}
