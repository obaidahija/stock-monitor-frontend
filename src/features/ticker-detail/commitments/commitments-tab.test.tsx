import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  appendCommitmentEvent,
  archiveCommitment,
  checkCommitmentSources,
  createManualCommitmentCandidate,
  extractCommitmentSource,
  getCommitment,
  getCommitmentCandidates,
  getCommitmentSources,
  getCommitments,
  loadCommitmentSource,
  reviewCommitmentCandidate,
} from '@/api/management-commitments'
import { renderWithProviders } from '@/test/render'
import type { SourceCoverageOut } from '@/types/management-commitments'
import { CommitmentsTab } from './commitments-tab'
import { ORIGINAL_QUOTE, revisedRevenueFixture, withProjection } from './fixtures'

vi.mock('@/api/management-commitments', () => ({
  getCommitments: vi.fn(),
  getCommitment: vi.fn(),
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

const emptyCoverage: SourceCoverageOut = {
  checked_at: null,
  window_days: null,
  window_start: null,
  window_end: null,
  filings_scanned: 0,
  documents_listed: 0,
  oldest_filing_date: null,
  newest_filing_date: null,
  truncated: false,
  complete: false,
  notices: [],
}

const summary = {
  id: revisedRevenueFixture.id,
  ticker: revisedRevenueFixture.ticker,
  identity: revisedRevenueFixture.identity,
  version: revisedRevenueFixture.version,
  archived: revisedRevenueFixture.archived,
  archive_reason: revisedRevenueFixture.archive_reason,
  related_commitment_id: null,
  projection: revisedRevenueFixture.projection,
  event_count: revisedRevenueFixture.event_count,
  created_at: revisedRevenueFixture.created_at,
  updated_at: revisedRevenueFixture.updated_at,
}

beforeEach(() => {
  vi.mocked(getCommitments).mockResolvedValue({
    items: [summary],
    total: 1,
    pending_count: 0,
    offset: 0,
    limit: 25,
    coverage: emptyCoverage,
  })
  vi.mocked(getCommitment).mockResolvedValue(revisedRevenueFixture)
  vi.mocked(getCommitmentSources).mockResolvedValue({
    items: [],
    total: 0,
    offset: 0,
    limit: 50,
    coverage: emptyCoverage,
  })
  vi.mocked(getCommitmentCandidates).mockResolvedValue({
    items: [],
    total: 0,
    pending_count: 0,
    offset: 0,
    limit: 50,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('opening the tab performs reads only', async () => {
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')
  expect(getCommitments).toHaveBeenCalledTimes(1)
  expect(checkCommitmentSources).not.toHaveBeenCalled()
  expect(loadCommitmentSource).not.toHaveBeenCalled()
  expect(extractCommitmentSource).not.toHaveBeenCalled()
  expect(createManualCommitmentCandidate).not.toHaveBeenCalled()
  expect(reviewCommitmentCandidate).not.toHaveBeenCalled()
  expect(appendCommitmentEvent).not.toHaveBeenCalled()
})

test('the ledger row shows both outcomes side by side', async () => {
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')
  expect(screen.getByText('Below original target')).toBeInTheDocument()
  expect(screen.getByText('Met latest target')).toBeInTheDocument()
  expect(screen.getByText(/1 revision/)).toBeInTheDocument()
})

test('expanding a row loads its full history', async () => {
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')
  expect(getCommitment).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Show history' }))
  await screen.findByTestId('commitment-timeline')

  expect(getCommitment).toHaveBeenCalledWith('ACME', 7)
  expect(screen.getByTestId('event-history').textContent).toContain(ORIGINAL_QUOTE)
})

test('an empty ledger points at the sources view', async () => {
  vi.mocked(getCommitments).mockResolvedValue({
    items: [],
    total: 0,
    pending_count: 0,
    offset: 0,
    limit: 25,
    coverage: emptyCoverage,
  })
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  expect(await screen.findByText(/No commitments have been recorded/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Find a source' }))
  expect(await screen.findByText(/No SEC check has been run/)).toBeInTheDocument()
  expect(checkCommitmentSources).not.toHaveBeenCalled()
})

test('the pending count is surfaced on the review view', async () => {
  vi.mocked(getCommitments).mockResolvedValue({
    items: [summary],
    total: 1,
    pending_count: 3,
    offset: 0,
    limit: 25,
    coverage: emptyCoverage,
  })
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')
  const reviewTab = screen.getByRole('tab', { name: /Review/ })
  expect(reviewTab.textContent).toContain('3')
})

test('views are reachable by keyboard', async () => {
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')

  screen.getByRole('tab', { name: /Sources/ }).focus()
  await userEvent.keyboard('{Enter}')
  // Both the view button and the panel heading read "Sources"; the panel's
  // own description is what proves the view actually switched.
  expect(await screen.findByText(/bounded search, not complete company coverage/i)).toBeInTheDocument()

  screen.getByRole('tab', { name: /Review/ }).focus()
  await userEvent.keyboard('{Enter}')
  expect(await screen.findByText('Pending review')).toBeInTheDocument()
})

test('an archived commitment is hidden from the default ledger', async () => {
  vi.mocked(getCommitments).mockResolvedValue({
    items: [],
    total: 0,
    pending_count: 0,
    offset: 0,
    limit: 25,
    coverage: emptyCoverage,
  })
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByText(/No commitments have been recorded/)
  expect(vi.mocked(getCommitments).mock.calls[0][1].include_archived).toBe(false)
})

test('an archived record can be found and restored through the ledger', async () => {
  let archived = true
  vi.mocked(getCommitments).mockImplementation(async (_ticker, filters) => ({
    items: !archived || filters.include_archived ? [{ ...summary, archived }] : [],
    total: !archived || filters.include_archived ? 1 : 0,
    pending_count: 0, offset: 0, limit: 25, coverage: emptyCoverage,
  }))
  vi.mocked(getCommitment).mockImplementation(async () => ({ ...revisedRevenueFixture, archived }))
  vi.mocked(archiveCommitment).mockImplementation(async () => {
    archived = false
    return { ...revisedRevenueFixture, archived: false }
  })
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByText(/No commitments have been recorded/)
  await userEvent.click(screen.getByRole('button', { name: 'Show archived' }))
  await screen.findByText('Archived', { exact: true })
  await userEvent.click(screen.getByRole('button', { name: 'Show history' }))
  await userEvent.type(await screen.findByLabelText('Reason for restoring'), 'Keep tracking this target')
  await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
  await waitFor(() => expect(archiveCommitment).toHaveBeenCalledTimes(1))
  await userEvent.click(screen.getByRole('button', { name: 'Hide archived' }))
  await screen.findByTestId('commitment-list')
  expect(screen.queryByText('Archived', { exact: true })).not.toBeInTheDocument()
  expect(vi.mocked(archiveCommitment).mock.calls[0][2].archived).toBe(false)
})

test('older archived records are reachable on later ledger pages', async () => {
  vi.mocked(getCommitments).mockImplementation(async (_ticker, filters) => ({
    items: [{ ...summary, id: filters.offset === 0 ? 7 : 8 }],
    total: 26, pending_count: 0, offset: filters.offset, limit: 25, coverage: emptyCoverage,
  }))
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(getCommitments).toHaveBeenLastCalledWith(
    'ACME', expect.objectContaining({ offset: 25 }),
  ))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled())
  await userEvent.click(screen.getByRole('button', { name: 'Show archived' }))
  await waitFor(() => expect(getCommitments).toHaveBeenLastCalledWith(
    'ACME', expect.objectContaining({ offset: 0, include_archived: true }),
  ))
})

test('a failed ledger read shows an error with a retry rather than an empty ledger', async () => {
  vi.mocked(getCommitments).mockRejectedValue(new Error('network down'))
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  expect(await screen.findByText('network down')).toBeInTheDocument()
  expect(screen.queryByText(/No commitments have been recorded/)).toBeNull()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})

test('a needs-review commitment never reads as a missed target', async () => {
  const needsReview = withProjection({
    status: 'needs_review',
    actual: null,
    original_comparison: null,
    latest_comparison: null,
    notices: ['conflicting_actuals'],
  })
  vi.mocked(getCommitments).mockResolvedValue({
    items: [{ ...summary, projection: needsReview.projection }],
    total: 1,
    pending_count: 0,
    offset: 0,
    limit: 25,
    coverage: emptyCoverage,
  })
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')
  expect(screen.getByText('Needs review')).toBeInTheDocument()
  expect(screen.queryByText(/Below original target/)).toBeNull()
})

test('the ledger renders at a 375px viewport without horizontal overflow', async () => {
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
  window.dispatchEvent(new Event('resize'))
  const { container } = renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')

  // The layout stacks with responsive grid classes rather than fixed widths,
  // so nothing forces the page wider than the viewport.
  const grids = container.querySelectorAll('[class*="sm:grid-cols"]')
  expect(grids.length).toBeGreaterThan(0)
  expect(container.querySelector('[style*="width:"]')).toBeNull()
})

test('a large amount survives from the API into the ledger row', async () => {
  const big = '9007199254740993'
  vi.mocked(getCommitments).mockResolvedValue({
    items: [
      {
        ...summary,
        projection: {
          ...summary.projection,
          original: {
            ...summary.projection.original!,
            target: { operator: 'range', lower: big, upper: big },
          },
        },
      },
    ],
    total: 1,
    pending_count: 0,
    offset: 0,
    limit: 25,
    coverage: emptyCoverage,
  })
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')
  expect(screen.getByText(/9,007,199,254,740,993 to USD 9,007,199,254,740,993/)).toBeInTheDocument()
})

test('history survives collapsing and re-expanding', async () => {
  renderWithProviders(<CommitmentsTab ticker="ACME" />)
  await screen.findByTestId('commitment-list')

  await userEvent.click(screen.getByRole('button', { name: 'Show history' }))
  await screen.findByTestId('commitment-timeline')
  await userEvent.click(screen.getByRole('button', { name: 'Hide history' }))
  expect(screen.queryByTestId('commitment-timeline')).toBeNull()

  await userEvent.click(screen.getByRole('button', { name: 'Show history' }))
  await waitFor(() => expect(screen.getByTestId('commitment-timeline')).toBeInTheDocument())
  expect(screen.getByTestId('event-history').children.length).toBe(3)
})
