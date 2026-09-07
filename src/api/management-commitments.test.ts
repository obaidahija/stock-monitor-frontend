import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import {
  appendCommitmentEvent,
  archiveCommitment,
  checkCommitmentSources,
  createManualCommitmentCandidate,
  extractCommitmentSource,
  getCommitment,
  getCommitmentCandidates,
  getCommitments,
  getCommitmentSource,
  getCommitmentSources,
  loadCommitmentSource,
  reviewCommitmentCandidate,
} from './management-commitments'

const get = vi.spyOn(apiClient, 'get')
const post = vi.spyOn(apiClient, 'post')

beforeEach(() => {
  get.mockResolvedValue({} as never)
  post.mockResolvedValue({} as never)
})

afterEach(() => {
  vi.clearAllMocks()
})

test('the ticker is uppercased and URL-encoded', async () => {
  await getCommitments('brk.b', {
    status: null,
    metric: null,
    include_archived: false,
    offset: 0,
    limit: 25,
  })
  expect(get).toHaveBeenCalledWith('/v1/stocks/BRK.B/commitments?offset=0&limit=25')
})

test('a ticker needing escaping is encoded', async () => {
  await getCommitmentSources('a b', { offset: 0, limit: 25 })
  expect(get).toHaveBeenCalledWith('/v1/stocks/A%20B/commitments/sources?offset=0&limit=25')
})

test('optional filters are omitted when unset', async () => {
  await getCommitments('ACME', {
    status: null,
    metric: null,
    include_archived: false,
    offset: 10,
    limit: 50,
  })
  const url = get.mock.calls[0][0]
  expect(url).toContain('offset=10')
  expect(url).toContain('limit=50')
  expect(url).not.toContain('status=')
  expect(url).not.toContain('metric=')
  expect(url).not.toContain('include_archived')
})

test('filters are sent when set', async () => {
  await getCommitments('ACME', {
    status: 'resolved',
    metric: 'revenue',
    include_archived: true,
    offset: 0,
    limit: 25,
  })
  const url = get.mock.calls[0][0]
  expect(url).toContain('status=resolved')
  expect(url).toContain('metric=revenue')
  expect(url).toContain('include_archived=true')
})

test('candidate state filter is optional', async () => {
  await getCommitmentCandidates('ACME', { offset: 0, limit: 25 })
  expect(get.mock.calls[0][0]).not.toContain('state=')
  await getCommitmentCandidates('ACME', { offset: 0, limit: 25, state: 'pending' })
  expect(get.mock.calls[1][0]).toContain('state=pending')
})

test('reads use GET and never POST', async () => {
  await getCommitments('ACME', {
    status: null,
    metric: null,
    include_archived: false,
    offset: 0,
    limit: 25,
  })
  await getCommitment('ACME', 3)
  await getCommitmentSources('ACME', { offset: 0, limit: 25 })
  await getCommitmentSource('ACME', 4, { offset: 0, limit: 25 })
  await getCommitmentCandidates('ACME', { offset: 0, limit: 25 })
  expect(get).toHaveBeenCalledTimes(5)
  expect(post).not.toHaveBeenCalled()
})

test('upstream actions are POSTs', async () => {
  await checkCommitmentSources('ACME')
  await loadCommitmentSource('ACME', 4, { offset: 0, limit: 25 })
  await extractCommitmentSource('ACME', 4)
  expect(post).toHaveBeenCalledTimes(3)
  expect(post.mock.calls[0][0]).toBe('/v1/stocks/ACME/commitments/sources/check')
  expect(post.mock.calls[1][0]).toBe(
    '/v1/stocks/ACME/commitments/sources/4/load?offset=0&limit=25',
  )
  expect(post.mock.calls[2][0]).toBe('/v1/stocks/ACME/commitments/sources/4/extract')
})

test('decimal strings are passed through untouched', async () => {
  const big = '9007199254740993'
  await appendCommitmentEvent('ACME', 3, {
    request_uuid: 'req-1',
    expected_version: 1,
    event: {
      kind: 'issued',
      payload: {
        kind: 'issued',
        statement_date: '2026-02-25',
        evidence: [],
        target: { operator: 'range', lower: big, upper: '9007199254740994' },
        actual_value: null,
        actual_basis: null,
        actual_definition: null,
        note: null,
      },
    },
  })
  const body = post.mock.calls[0][1] as { event: { payload: { target: { lower: string } } } }
  expect(body.event.payload.target.lower).toBe(big)
  expect(typeof body.event.payload.target.lower).toBe('string')
})

test('review and archive post to their own paths', async () => {
  await reviewCommitmentCandidate('ACME', 9, { action: 'reject', request_uuid: 'r' })
  await archiveCommitment('ACME', 3, {
    request_uuid: 'r',
    expected_version: 1,
    archived: true,
    reason: 'wrong issuer',
  })
  await createManualCommitmentCandidate('ACME', {
    document_id: 4,
    proposal: {} as never,
  })
  expect(post.mock.calls[0][0]).toBe('/v1/stocks/ACME/commitments/candidates/9/review')
  expect(post.mock.calls[1][0]).toBe('/v1/stocks/ACME/commitments/3/archive')
  expect(post.mock.calls[2][0]).toBe('/v1/stocks/ACME/commitments/candidates')
})
