import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  checkCommitmentSources,
  extractCommitmentSource,
  getCommitmentSource,
  getCommitmentSources,
  loadCommitmentSource,
} from '@/api/management-commitments'
import { renderWithProviders } from '@/test/render'
import type {
  SourceCoverageOut,
  SourceDocumentOut,
  SourceRefOut,
  SourcesPageOut,
} from '@/types/management-commitments'
import { SourcePicker } from './source-picker'

vi.mock('@/api/management-commitments', () => ({
  getCommitmentSources: vi.fn(),
  getCommitmentSource: vi.fn(),
  checkCommitmentSources: vi.fn(),
  loadCommitmentSource: vi.fn(),
  extractCommitmentSource: vi.fn(),
  getCommitments: vi.fn(),
  getCommitment: vi.fn(),
  getCommitmentCandidates: vi.fn(),
  createManualCommitmentCandidate: vi.fn(),
  reviewCommitmentCandidate: vi.fn(),
  appendCommitmentEvent: vi.fn(),
  archiveCommitment: vi.fn(),
}))

const coverage = (overrides: Partial<SourceCoverageOut> = {}): SourceCoverageOut => ({
  checked_at: '2026-09-01T12:00:00Z',
  window_days: 730,
  window_start: '2024-09-01',
  window_end: '2026-09-01',
  filings_scanned: 6,
  documents_listed: 2,
  oldest_filing_date: '2024-10-01',
  newest_filing_date: '2026-02-25',
  truncated: false,
  complete: true,
  notices: [],
  ...overrides,
})

const source = (overrides: Partial<SourceRefOut> = {}): SourceRefOut => ({
  document_id: 11,
  accession_number: '0001750260-26-000012',
  filename: 'ex991pressrelease.htm',
  form_type: '8-K',
  description: 'Press release dated February 25, 2026',
  source_date: '2026-02-25',
  url: 'https://www.sec.gov/Archives/edgar/data/1750/000175026026000012/ex991pressrelease.htm',
  content_state: 'never_checked',
  content_hash: null,
  content_version: 1,
  is_amendment: false,
  supported: true,
  block_count: 0,
  fetched_at: null,
  ...overrides,
})

const page = (items: SourceRefOut[], cov = coverage()): SourcesPageOut => ({
  items,
  total: items.length,
  offset: 0,
  limit: 50,
  coverage: cov,
})

const document = (overrides: Partial<SourceDocumentOut> = {}): SourceDocumentOut => ({
  document: source({ content_state: 'ready', content_hash: 'a'.repeat(64), block_count: 2 }),
  blocks: [
    { block_id: 'b0000', order: 0, kind: 'heading', text: 'Financial Outlook', headers: [] },
    {
      block_id: 'b0001',
      order: 1,
      kind: 'paragraph',
      text: 'We expect revenue of $100 million to $110 million.',
      headers: [],
    },
  ],
  total_blocks: 2,
  offset: 0,
  limit: 100,
  notices: [],
  source: null,
  ...overrides,
})

function renderPicker(props: Partial<Parameters<typeof SourcePicker>[0]> = {}) {
  return renderWithProviders(
    <SourcePicker
      ticker="ACME"
      selectedDocumentId={undefined}
      onSelectDocument={() => {}}
      onEnterManually={() => {}}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.mocked(getCommitmentSources).mockResolvedValue(page([source()]))
  vi.mocked(getCommitmentSource).mockResolvedValue(document())
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('mounting reads sources and starts no upstream work', async () => {
  renderPicker()
  await screen.findByText('Press release dated February 25, 2026')
  expect(getCommitmentSources).toHaveBeenCalledTimes(1)
  expect(checkCommitmentSources).not.toHaveBeenCalled()
  expect(loadCommitmentSource).not.toHaveBeenCalled()
  expect(extractCommitmentSource).not.toHaveBeenCalled()
})

test('coverage shows the window and last check, and never claims completeness it lacks', async () => {
  vi.mocked(getCommitmentSources).mockResolvedValue(
    page([source()], coverage({ complete: false, truncated: true })),
  )
  renderPicker()
  const line = await screen.findByTestId('source-coverage')
  expect(line.textContent).toContain('Scanned 6 filings')
  expect(line.textContent).toContain('partial')
})

test('a never-run check is distinguishable from an empty result', async () => {
  vi.mocked(getCommitmentSources).mockResolvedValue(
    page([], coverage({ checked_at: null, documents_listed: 0 })),
  )
  renderPicker()
  expect(await screen.findByText(/No SEC check has been run/i)).toBeInTheDocument()

  cleanup()
  vi.mocked(getCommitmentSources).mockResolvedValue(
    page([], coverage({ documents_listed: 0 })),
  )
  renderPicker()
  expect(await screen.findByText(/found no matching filings/i)).toBeInTheDocument()
})

test('an amendment is badged rather than merged into the original', async () => {
  vi.mocked(getCommitmentSources).mockResolvedValue(
    page([source(), source({ document_id: 12, is_amendment: true, form_type: '8-K/A' })]),
  )
  renderPicker()
  expect(await screen.findByText('Amendment')).toBeInTheDocument()
})

test('a PDF is listed with its SEC link but cannot be selected', async () => {
  vi.mocked(getCommitmentSources).mockResolvedValue(
    page([source({ document_id: 13, filename: 'deck.pdf', supported: false, description: 'Deck' })]),
  )
  renderPicker()
  expect(await screen.findByText(/PDF — open on SEC/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /SEC/i })).toHaveAttribute(
    'href',
    expect.stringContaining('sec.gov'),
  )
})

test('a failed check keeps the saved sources on screen', async () => {
  vi.mocked(checkCommitmentSources).mockResolvedValue({
    status: 'unavailable',
    reason: 'edgar unreachable',
    sources: page([source()]),
    source: { name: 'edgar', ok: false, fetched_at: null, error: 'unreachable', latency_ms: null },
  })
  renderPicker()
  await screen.findByText('Press release dated February 25, 2026')

  await userEvent.click(screen.getByRole('button', { name: /Check SEC/i }))
  expect(await screen.findByText(/SEC could not be reached/i)).toBeInTheDocument()
  expect(screen.getByText('Press release dated February 25, 2026')).toBeInTheDocument()
})

test('selecting a source loads it by keyboard', async () => {
  const onSelect = vi.fn()
  vi.mocked(loadCommitmentSource).mockResolvedValue(document())
  renderPicker({ onSelectDocument: onSelect })
  const button = await screen.findByRole('button', { name: 'Select' })

  button.focus()
  await userEvent.keyboard('{Enter}')

  await waitFor(() => expect(loadCommitmentSource).toHaveBeenCalledTimes(1))
  expect(onSelect).toHaveBeenCalledWith(11)
})

test('a selected source offers manual entry with no provider call', async () => {
  const onEnterManually = vi.fn()
  vi.mocked(loadCommitmentSource).mockResolvedValue(document())
  renderPicker({ selectedDocumentId: 11, onEnterManually })

  const manual = await screen.findByRole('button', { name: /Add a statement manually/i })
  await userEvent.click(manual)

  expect(onEnterManually).toHaveBeenCalledTimes(1)
  expect(onEnterManually.mock.calls[0][0]).toBe(11)
  expect(extractCommitmentSource).not.toHaveBeenCalled()
})

test('extraction reports its outcome and never records anything itself', async () => {
  vi.mocked(extractCommitmentSource).mockResolvedValue({
    status: 'ready',
    extraction_id: 3,
    document_id: 11,
    reason: null,
    candidates: [],
    candidate_count: 2,
    notices: [],
    coverage: null,
    source: null,
    ai: null,
  })
  renderPicker({ selectedDocumentId: 11 })

  await userEvent.click(await screen.findByRole('button', { name: /Propose statements/i }))

  const note = await screen.findByTestId('extraction-note')
  expect(note.textContent).toContain('2 statements proposed')
  expect(note.textContent).toMatch(/Review them before anything is recorded/i)
})

test('a failed extraction explains itself and keeps manual entry available', async () => {
  vi.mocked(extractCommitmentSource).mockResolvedValue({
    status: 'failed',
    extraction_id: 3,
    document_id: 11,
    reason: 'ai_deadline_reached',
    candidates: [],
    candidate_count: 0,
    notices: ['ai_deadline_reached'],
    coverage: null,
    source: null,
    ai: null,
  })
  renderPicker({ selectedDocumentId: 11 })

  await userEvent.click(await screen.findByRole('button', { name: /Propose statements/i }))

  const note = await screen.findByTestId('extraction-note')
  expect(note.textContent).toMatch(/did not respond within the time budget/i)
  expect(screen.getByRole('button', { name: /Add a statement manually/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Propose statements/i })).toBeEnabled()
})

test('an extraction already running says so rather than starting another', async () => {
  vi.mocked(extractCommitmentSource).mockResolvedValue({
    status: 'running',
    extraction_id: 3,
    document_id: 11,
    reason: null,
    candidates: [],
    candidate_count: 0,
    notices: [],
    coverage: null,
    source: null,
    ai: null,
  })
  renderPicker({ selectedDocumentId: 11 })
  await userEvent.click(await screen.findByRole('button', { name: /Propose statements/i }))
  expect((await screen.findByTestId('extraction-note')).textContent).toMatch(/already running/i)
})

test('all rejected proposals are described as a validation failure with an explicit retry', async () => {
  vi.mocked(extractCommitmentSource).mockResolvedValue({
    status: 'failed', extraction_id: 3, document_id: 11,
    reason: 'all_proposals_rejected', candidates: [], candidate_count: 0,
    notices: ['quote_mismatch'], coverage: null, source: null, ai: null,
  })
  renderPicker({ selectedDocumentId: 11 })
  const button = await screen.findByRole('button', { name: /Propose statements/i })
  await userEvent.click(button)
  expect((await screen.findByTestId('extraction-note')).textContent).toMatch(/none.*passed validation/i)
  expect(screen.queryByText(/No statements were proposed/)).not.toBeInTheDocument()
  await userEvent.click(button)
  await waitFor(() => expect(extractCommitmentSource).toHaveBeenCalledTimes(2))
})
