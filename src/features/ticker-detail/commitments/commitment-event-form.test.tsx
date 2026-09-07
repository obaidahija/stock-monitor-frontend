import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { appendCommitmentEvent, archiveCommitment } from '@/api/management-commitments'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { CommitmentEventForm } from './commitment-event-form'
import { revisedRevenueFixture, withProjection } from './fixtures'

vi.mock('@/api/management-commitments', () => ({
  appendCommitmentEvent: vi.fn(),
  archiveCommitment: vi.fn(),
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
}))

beforeEach(() => {
  vi.mocked(appendCommitmentEvent).mockResolvedValue(revisedRevenueFixture)
  vi.mocked(archiveCommitment).mockResolvedValue(revisedRevenueFixture)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function render(commitment = revisedRevenueFixture) {
  return renderWithProviders(<CommitmentEventForm ticker="ACME" commitment={commitment} />)
}

async function openForm() {
  await userEvent.click(screen.getByRole('button', { name: /Record a statement/i }))
}

test('the form is closed until asked for and shows the current version', () => {
  render()
  expect(screen.getByText('Version 3')).toBeInTheDocument()
  expect(screen.queryByLabelText('Statement date')).not.toBeInTheDocument()
})

test('recording a revision sends the current version and reused evidence', async () => {
  render()
  await openForm()
  await userEvent.type(screen.getByLabelText('Statement date'), '2026-11-01')
  await userEvent.type(screen.getByLabelText('Lower bound'), '80000000')
  await userEvent.type(screen.getByLabelText('Upper bound'), '85000000')
  await userEvent.click(screen.getByRole('button', { name: 'Record statement' }))

  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(1))
  const [, , body] = vi.mocked(appendCommitmentEvent).mock.calls[0]
  expect(body.expected_version).toBe(3)
  expect(body.event.kind).toBe('revised')
  expect(body.event.payload.target).toEqual({
    operator: 'range',
    lower: '80000000',
    upper: '85000000',
  })
  // Evidence is reused from a saved record, never authored in the form.
  expect(body.event.payload.evidence.length).toBeGreaterThan(0)
  expect(body.event.payload.evidence[0].content_hash).toHaveLength(64)
})

test('a correction requires both the corrected record and a note', async () => {
  render()
  await openForm()
  await userEvent.click(screen.getByLabelText('Statement kind'))
  await userEvent.click(await screen.findByRole('option', { name: 'Record corrected' }))
  await userEvent.type(screen.getByLabelText('Statement date'), '2026-02-25')

  const submit = screen.getByRole('button', { name: 'Record statement' })
  expect(submit).toBeDisabled()
  expect(screen.getByText(/the record being corrected/i)).toBeInTheDocument()
  expect(screen.getByText(/a correction note/i)).toBeInTheDocument()

  await userEvent.click(screen.getByLabelText('Record being corrected'))
  await userEvent.click(await screen.findByRole('option', { name: /#1 Guidance issued/ }))
  await userEvent.type(screen.getByLabelText(/^Note/), 'transcription fix')

  await waitFor(() => expect(submit).toBeEnabled())
  await userEvent.click(submit)

  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(1))
  const body = vi.mocked(appendCommitmentEvent).mock.calls[0][2]
  expect(body.event.kind).toBe('correction')
  expect(body.event.supersedes_event_id).toBe(1)
  expect(body.event.note).toBe('transcription fix')
  // A correction replaces the record's own kind, not an arbitrary one.
  expect(body.event.payload.kind).toBe('issued')
})

test('the request id is held across a retry of the same mutation', async () => {
  vi.mocked(appendCommitmentEvent).mockRejectedValueOnce(new Error('network'))
  render()
  await openForm()
  await userEvent.type(screen.getByLabelText('Statement date'), '2026-11-01')
  await userEvent.type(screen.getByLabelText('Lower bound'), '80000000')

  const submit = screen.getByRole('button', { name: 'Record statement' })
  await userEvent.click(submit)
  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(1))
  await userEvent.click(submit)
  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(2))

  const first = vi.mocked(appendCommitmentEvent).mock.calls[0][2].request_uuid
  const second = vi.mocked(appendCommitmentEvent).mock.calls[1][2].request_uuid
  expect(second).toBe(first)
})

test('a materially different mutation gets a new request id', async () => {
  render()
  await openForm()
  await userEvent.type(screen.getByLabelText('Statement date'), '2026-11-01')
  await userEvent.type(screen.getByLabelText('Lower bound'), '80000000')
  await userEvent.click(screen.getByRole('button', { name: 'Record statement' }))
  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(1))
  const first = vi.mocked(appendCommitmentEvent).mock.calls[0][2].request_uuid

  // Reopen and switch to a different statement kind: the entered date is
  // retained, so this is the same reviewer asking for something else.
  await openForm()
  await userEvent.click(screen.getByLabelText('Statement kind'))
  await userEvent.click(await screen.findByRole('option', { name: 'Guidance reaffirmed' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Record statement' })).toBeEnabled(),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Record statement' }))

  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(2))
  expect(vi.mocked(appendCommitmentEvent).mock.calls[1][2].request_uuid).not.toBe(first)
})

test('a 409 keeps the input on screen and never resubmits on its own', async () => {
  vi.mocked(appendCommitmentEvent).mockRejectedValue(
    new ApiError(409, { code: 'stale_version', current_version: 5 }),
  )
  render()
  await openForm()
  await userEvent.type(screen.getByLabelText('Statement date'), '2026-11-01')
  await userEvent.type(screen.getByLabelText('Lower bound'), '80000000')
  await userEvent.click(screen.getByRole('button', { name: 'Record statement' }))

  expect(await screen.findByText(/changed while you were editing/i)).toBeInTheDocument()
  expect(screen.getByLabelText('Lower bound')).toHaveValue('80000000')
  expect(appendCommitmentEvent).toHaveBeenCalledTimes(1)
})

test('archiving requires a reason and preserves history', async () => {
  render()
  const archiveButton = screen.getByRole('button', { name: 'Archive' })
  expect(archiveButton).toBeDisabled()

  await userEvent.type(screen.getByLabelText('Reason for archiving'), 'wrong issuer')
  await waitFor(() => expect(archiveButton).toBeEnabled())
  await userEvent.click(archiveButton)

  await waitFor(() => expect(archiveCommitment).toHaveBeenCalledTimes(1))
  const body = vi.mocked(archiveCommitment).mock.calls[0][2]
  expect(body.archived).toBe(true)
  expect(body.reason).toBe('wrong issuer')
  expect(body.expected_version).toBe(3)
})

test('an archived commitment offers restore instead', async () => {
  render(withProjection({}, { archived: true, archive_reason: 'mistake' }))
  expect(screen.getByLabelText('Reason for restoring')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Reason for restoring'), 'was correct after all')
  await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
  await waitFor(() => expect(archiveCommitment).toHaveBeenCalledTimes(1))
  expect(vi.mocked(archiveCommitment).mock.calls[0][2].archived).toBe(false)
})

test('recording an actual sends a value and no target', async () => {
  render()
  await openForm()
  await userEvent.click(screen.getByLabelText('Statement kind'))
  await userEvent.click(await screen.findByRole('option', { name: 'Result reported' }))
  await userEvent.type(screen.getByLabelText('Statement date'), '2027-02-24')
  await userEvent.type(screen.getByLabelText('Reported result'), '93000000')
  await userEvent.click(screen.getByRole('button', { name: 'Record statement' }))

  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(1))
  const payload = vi.mocked(appendCommitmentEvent).mock.calls[0][2].event.payload
  expect(payload.actual_value).toBe('93000000')
  expect(payload.target).toBeNull()
})

test('correcting a result edits its value and preserves that result evidence and basis', async () => {
  render()
  await openForm()
  await userEvent.click(screen.getByLabelText('Statement kind'))
  await userEvent.click(await screen.findByRole('option', { name: 'Record corrected' }))
  await userEvent.click(screen.getByLabelText('Record being corrected'))
  await userEvent.click(await screen.findByRole('option', { name: /#3 Result reported/ }))
  const result = screen.getByLabelText('Reported result')
  expect(result).toHaveValue('93000000')
  expect(screen.queryByLabelText('Lower bound')).not.toBeInTheDocument()
  await userEvent.clear(result)
  expect(screen.getByRole('button', { name: 'Record statement' })).toBeDisabled()
  await userEvent.type(result, '94000000')
  await userEvent.type(screen.getByLabelText(/^Note/), 'Fix transcribed result')
  await userEvent.click(screen.getByRole('button', { name: 'Record statement' }))
  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(1))
  expect(vi.mocked(appendCommitmentEvent).mock.calls[0][2].event).toMatchObject({
    kind: 'correction', supersedes_event_id: 3,
    payload: {
      kind: 'actual', statement_date: '2027-02-24', target: null,
      actual_value: '94000000', actual_basis: 'gaap',
      evidence: revisedRevenueFixture.events[2].payload.evidence,
    },
  })
})

test('a large amount survives the form as an exact string', async () => {
  const big = '9007199254740993'
  render()
  await openForm()
  await userEvent.type(screen.getByLabelText('Statement date'), '2026-11-01')
  await userEvent.type(screen.getByLabelText('Lower bound'), big)
  await userEvent.click(screen.getByRole('button', { name: 'Record statement' }))

  await waitFor(() => expect(appendCommitmentEvent).toHaveBeenCalledTimes(1))
  expect(vi.mocked(appendCommitmentEvent).mock.calls[0][2].event.payload.target?.lower).toBe(big)
})

test('the keyboard alone can open the form and reach the fields', async () => {
  render()
  screen.getByRole('button', { name: /Record a statement/i }).focus()
  await userEvent.keyboard('{Enter}')
  expect(screen.getByLabelText('Statement date')).toBeInTheDocument()

  await userEvent.tab()
  expect(document.activeElement).toBeInstanceOf(HTMLElement)
})
