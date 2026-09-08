import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  compareAnnualFilings,
  explainFilingChanges,
  getFilingChangePage,
  getFilingChanges,
  getFilingInsightSummary,
  refreshFilingInsightSummary,
} from '@/api/filing-changes'
import type {
  FilingChangeOut,
  FilingChangesPageOut,
  FilingComparisonOut,
} from '@/types/filing-changes'
import { FilingChangesPanel } from './filing-changes-panel'

vi.mock('@/api/filing-changes', () => ({
  getFilingChanges: vi.fn(),
  compareAnnualFilings: vi.fn(),
  getFilingChangePage: vi.fn(),
  explainFilingChanges: vi.fn(),
  getFilingInsightSummary: vi.fn(),
  refreshFilingInsightSummary: vi.fn(),
}))

const insightSummary = {
  status: 'ready' as const,
  signal: 'negative' as const,
  confidence: 'high' as const,
  headline: 'Supply constraints became more immediate',
  explanation: 'The filing now describes constraints as current.',
  key_positives: [], key_negatives: [], key_neutral: [], key_facts: [],
  coverage: { status: 'complete' as const, included: [], excluded: [], notices: [] },
  generated_at: '2026-09-07T12:00:00Z', stale: false,
  analysis_version: 'filing-insight-v1', usage: null,
}

const okCoverage = { status: 'ok' as const, reason: null, notes: [] }

const comparison = (overrides: Partial<FilingComparisonOut> = {}): FilingComparisonOut => ({
  id: 7,
  ticker: 'NVDA',
  before: {
    accession_number: '0001045810-24-000029',
    form_type: '10-K',
    report_date: '2024-01-28',
    filed_date: '2024-02-21',
    filing_url: 'https://www.sec.gov/before.htm',
  },
  after: {
    accession_number: '0001045810-25-000023',
    form_type: '10-K',
    report_date: '2025-01-26',
    filed_date: '2025-02-26',
    filing_url: 'https://www.sec.gov/after.htm',
  },
  status: 'ready',
  coverage: {
    risk_factors: { before: okCoverage, after: okCoverage },
    mda: { before: okCoverage, after: okCoverage },
  },
  notices: [],
  counts: { added: 1, removed: 1, modified: 1 },
  routine_count: 2,
  explained_count: 0,
  generated_at: '2026-09-06T12:00:00Z',
  metadata_checked_at: '2026-09-06T12:30:00Z',
  ai_status: 'not_requested',
  ai_error: null,
  usage: null,
  ...overrides,
})

const change = (overrides: Partial<FilingChangeOut> = {}): FilingChangeOut => ({
  id: 'c1',
  section: 'risk_factors',
  kind: 'modified',
  before: {
    id: 'p1',
    text: 'We do not expect a shortfall.',
    heading: 'Liquidity Risks',
    anchor: null,
    start: 0,
    end: 29,
  },
  after: {
    id: 'p2',
    text: 'We do expect a shortfall.',
    heading: 'Liquidity Risks',
    anchor: null,
    start: 0,
    end: 25,
  },
  before_spans: [
    { text: 'We do ', changed: false },
    { text: 'not ', changed: true },
    { text: 'expect a shortfall.', changed: false },
  ],
  after_spans: [
    { text: 'We do ', changed: false },
    { text: 'expect a shortfall.', changed: false },
  ],
  alignment_confidence: 'high',
  routine_date_update: false,
  annotation: null,
  ...overrides,
})

const page = (overrides: Partial<FilingChangesPageOut> = {}): FilingChangesPageOut => ({
  items: [change()],
  total: 1,
  offset: 0,
  limit: 25,
  ...overrides,
})

function renderPanel(ticker = 'NVDA') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <FilingChangesPanel ticker={ticker} />
    </QueryClientProvider>,
  )
}

async function expandEvidence() {
  const summary = screen.getByText('Evidence & All Changes')
  if (!summary.closest('details')?.hasAttribute('open')) {
    await userEvent.click(summary)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getFilingChanges).mockResolvedValue(null)
  vi.mocked(getFilingChangePage).mockResolvedValue(page())
  vi.mocked(getFilingInsightSummary).mockResolvedValue(insightSummary)
})
afterEach(cleanup)

test('cached insight is first and raw evidence stays lazy until expanded', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison({
    counts: { added: 67, removed: 65, modified: 71 },
  }))
  renderPanel()
  expect(await screen.findByText('Supply constraints became more immediate')).toBeInTheDocument()
  expect(refreshFilingInsightSummary).not.toHaveBeenCalled()
  expect(getFilingChangePage).not.toHaveBeenCalled()

  await userEvent.click(screen.getByText('Evidence & All Changes'))
  await waitFor(() => expect(getFilingChangePage).toHaveBeenCalledTimes(1))
})

test('refresh analysis is the only top-level action', async () => {
  vi.mocked(refreshFilingInsightSummary).mockResolvedValue({
    status: 'ready', reason: null, summary: insightSummary,
    source: {} as never, ai: null, diagnostics: { comparison_changed: false },
  } as never)
  renderPanel()
  await userEvent.click(await screen.findByRole('button', { name: 'Refresh analysis' }))
  await waitFor(() => expect(refreshFilingInsightSummary).toHaveBeenCalledWith('NVDA'))
})

test('a saved-comparison read error is not shown as an empty cache', async () => {
  vi.mocked(getFilingChanges).mockRejectedValue(new Error('Saved comparison unavailable'))
  renderPanel()
  expect(await screen.findByText('Saved comparison unavailable')).toBeInTheDocument()
  expect(screen.queryByText(/no comparison saved yet/i)).not.toBeInTheDocument()
})

test('an explanation network error is visible while evidence remains', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(explainFilingChanges).mockRejectedValue(new Error('Explanation request failed'))
  const user = userEvent.setup()
  renderPanel()
  await expandEvidence()
  await user.click(await screen.findByRole('button', { name: /explain changes/i }))
  expect(await screen.findByText('Explanation request failed')).toBeInTheDocument()
  expect(screen.getAllByText(/expect a shortfall/).length).toBeGreaterThan(0)
})

test('hidden routine updates are not described as no text changes', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison({
    counts: { added: 0, removed: 0, modified: 2 }, routine_count: 2,
  }))
  vi.mocked(getFilingChangePage).mockResolvedValue(page({ items: [], total: 0 }))
  renderPanel()
  await expandEvidence()
  expect(await screen.findByText(/only routine date updates were detected/i)).toBeInTheDocument()
  expect(screen.queryByText(/no text changes detected/i)).not.toBeInTheDocument()
})

test('insufficient history explains the annual comparison requirement', async () => {
  vi.mocked(compareAnnualFilings).mockResolvedValue({
    status: 'unavailable', reason: 'insufficient_history', comparison: null,
    source: { name: 'edgar', ok: false, error: 'insufficient_history', fetched_at: null, latency_ms: null },
  })
  const user = userEvent.setup()
  renderPanel()
  await user.click(screen.getByRole('button', { name: /compare latest annual filings/i }))
  expect(await screen.findByText(/two comparable annual 10-K filings/i)).toBeInTheDocument()
})

// --- initial and empty states ----------------------------------------------

test('mounting never starts a comparison or a generation', async () => {
  renderPanel()
  await waitFor(() => expect(getFilingChanges).toHaveBeenCalled())
  expect(compareAnnualFilings).not.toHaveBeenCalled()
  expect(explainFilingChanges).not.toHaveBeenCalled()
  expect(await screen.findByText(/no comparison saved yet/i)).toBeInTheDocument()
})

test('the panel explains that added wording does not prove a new risk', async () => {
  renderPanel()
  expect(
    screen.getByText(/added wording does not prove a new risk arose/i),
  ).toBeInTheDocument()
})

// --- saved evidence ----------------------------------------------------------

test('a saved comparison shows both periods, filed dates and SEC links', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  renderPanel()

  await screen.findAllByText(/FY ending Jan 28, 2024/)
  expect(screen.getAllByText(/FY ending Jan 26, 2025/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/filed Feb 21, 2024/).length).toBeGreaterThan(0)

  const links = screen.getAllByRole('link')
  expect(links.some((a) => a.getAttribute('href') === 'https://www.sec.gov/before.htm')).toBe(
    true,
  )
  expect(screen.getByText(/SEC metadata last checked/i)).toBeInTheDocument()
})

test('word-level changes use markup, not colour alone, and never raw HTML', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(getFilingChangePage).mockResolvedValue(
    page({
      items: [
        change({
          before_spans: [{ text: '<b>not</b> expected', changed: true }],
          after_spans: [{ text: 'expected', changed: false }],
        }),
      ],
    }),
  )
  const { container } = renderPanel()
  await expandEvidence()

  await waitFor(() => expect(container.querySelector('del')).not.toBeNull())
  // Source wording is rendered as text, never injected as markup.
  expect(container.querySelector('del b')).toBeNull()
  expect(screen.getByText(/<b>not<\/b> expected/)).toBeInTheDocument()
})

test('a missing side says so explicitly rather than showing an empty column', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(getFilingChangePage).mockResolvedValue(
    page({
      items: [
        change({
          kind: 'added',
          before: null,
          before_spans: [],
        }),
      ],
    }),
  )
  renderPanel()
  await expandEvidence()

  await screen.findByText('No matched passage in this section')
})

test('a low-confidence match tells the reader to review the source', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(getFilingChangePage).mockResolvedValue(
    page({ items: [change({ alignment_confidence: 'low' })] }),
  )
  renderPanel()
  await expandEvidence()

  await screen.findByText(/possible unmatched passage/i)
})

// --- coverage and notices ----------------------------------------------------

test('partial coverage is stated and never reads as no changes', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(
    comparison({
      status: 'partial',
      coverage: {
        risk_factors: { before: okCoverage, after: okCoverage },
        mda: {
          before: { status: 'missing', reason: 'no heading', notes: [] },
          after: okCoverage,
        },
      },
    }),
  )
  renderPanel()

  await screen.findByText(/Partial coverage/)
  expect(
    screen.getByText(/could not be located in this filing \(earlier filing\), so it was not compared/i),
  ).toBeInTheDocument()
})

test('an amendment notice is shown without claiming complete coverage', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(
    comparison({
      notices: ['amendments_present'],
      coverage: {
        risk_factors: {
          before: { ...okCoverage, notes: ['numeric_tables_excluded'] },
          after: okCoverage,
        },
      },
    }),
  )
  renderPanel()

  await screen.findByText(/amendments are not incorporated/i)
  expect(
    screen.getByText(/does not cover the complete filing/i),
  ).toBeInTheDocument()
})

test('no-change copy only appears for sections actually compared', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison({ counts: { added: 0, removed: 0, modified: 0 }, routine_count: 0 }))
  vi.mocked(getFilingChangePage).mockResolvedValue(page({ items: [], total: 0 }))
  renderPanel()
  await expandEvidence()

  await screen.findByText(/no text changes detected in the compared prose/i)
})

test('with nothing comparable the panel refuses to claim no changes', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(
    comparison({
      counts: { added: 0, removed: 0, modified: 0 },
      coverage: {
        risk_factors: {
          before: { status: 'ambiguous', reason: 'no closing heading', notes: [] },
          after: okCoverage,
        },
      },
    }),
  )
  vi.mocked(getFilingChangePage).mockResolvedValue(page({ items: [], total: 0 }))
  renderPanel()
  await expandEvidence()

  await screen.findByText(/no conclusion about changes is possible/i)
})

// --- actions -----------------------------------------------------------------

test('comparing is explicit and disabled while pending', async () => {
  const user = userEvent.setup()
  let resolve: (value: unknown) => void = () => {}
  vi.mocked(compareAnnualFilings).mockReturnValue(
    new Promise((r) => {
      resolve = r
    }) as never,
  )
  renderPanel()

  const button = screen.getByRole('button', { name: /compare latest annual filings/i })
  await user.click(button)
  expect(await screen.findByRole('button', { name: /comparing/i })).toBeDisabled()

  resolve({
    status: 'ready',
    reason: null,
    comparison: comparison(),
    source: { name: 'edgar', ok: true, fetched_at: null, error: null, latency_ms: null },
  })
  await waitFor(() => expect(compareAnnualFilings).toHaveBeenCalledTimes(1))
})

test('a failed refresh keeps the saved result visible', async () => {
  const user = userEvent.setup()
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(compareAnnualFilings).mockResolvedValue({
    status: 'unavailable',
    reason: 'EDGAR document fetch 429',
    comparison: comparison(),
    source: {
      name: 'edgar',
      ok: false,
      fetched_at: null,
      error: 'EDGAR document fetch 429',
      latency_ms: null,
    },
  })
  renderPanel()

  await screen.findAllByText(/FY ending Jan 26, 2025/)
  await user.click(screen.getByRole('button', { name: /compare latest annual filings/i }))

  await screen.findByText(/could not refresh from sec/i)
  // The evidence is still on screen -- in the summary and in every card.
  expect(screen.getAllByText(/FY ending Jan 26, 2025/).length).toBeGreaterThan(0)
})

test('an AI failure keeps the passages and says explanations are unavailable', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(
    comparison({ ai_status: 'unavailable', ai_error: 'no provider' }),
  )
  renderPanel()
  await expandEvidence()

  await screen.findByText(/ai explanations are unavailable/i)
  expect(screen.getByText(/the compared passages below are unaffected/i)).toBeInTheDocument()
  expect((await screen.findAllByText(/expect a shortfall/)).length).toBeGreaterThan(0)
})

test('explanation coverage is shown and explaining does not recompare', async () => {
  const user = userEvent.setup()
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(explainFilingChanges).mockResolvedValue({
    comparison: comparison({ ai_status: 'ready', explained_count: 2 }),
    source: { name: 'llm', ok: true, fetched_at: null, error: null, latency_ms: null },
  })
  renderPanel()

  await screen.findByText(/0 of 3 changes explained/i)
  await user.click(screen.getByRole('button', { name: /explain changes/i }))

  await screen.findByText(/2 of 3 changes explained/i)
  expect(compareAnnualFilings).not.toHaveBeenCalled()
})

test('an AI explanation is labelled and kept below the quotations', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(getFilingChangePage).mockResolvedValue(
    page({
      items: [
        change({
          annotation: {
            id: 'c1',
            explanation: 'The negation was removed from this statement.',
            topics: ['liquidity'],
          },
        }),
      ],
    }),
  )
  renderPanel()
  await expandEvidence()

  const label = await screen.findByText('AI explanation')
  expect(label).toBeInTheDocument()
  expect(
    screen.getByText('The negation was removed from this statement.'),
  ).toBeInTheDocument()
})

// --- filters and paging -------------------------------------------------------

test('routine updates are hidden with an explicit hidden count', async () => {
  const user = userEvent.setup()
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  renderPanel()
  await expandEvidence()

  const toggle = await screen.findByRole('button', {
    name: /show routine updates \(2 hidden\)/i,
  })
  await user.click(toggle)

  await waitFor(() =>
    expect(getFilingChangePage).toHaveBeenLastCalledWith(
      'NVDA',
      7,
      expect.objectContaining({ include_routine: true }),
    ),
  )
})

test('a filter with no matches says so distinctly', async () => {
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(getFilingChangePage).mockResolvedValue(page({ items: [], total: 0 }))
  const user = userEvent.setup()
  renderPanel()
  await expandEvidence()

  await screen.findByLabelText('Change type')
  await user.click(screen.getByLabelText('Change type'))
  await user.click(await screen.findByRole('option', { name: 'Added' }))

  await screen.findByText(/no changes match these filters/i)
})

test('paging requests the next slice and reports the range', async () => {
  const user = userEvent.setup()
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(getFilingChangePage).mockResolvedValue(
    page({ items: [change()], total: 60, limit: 25 }),
  )
  renderPanel()
  await expandEvidence()

  await screen.findByText('1–25 of 60')
  await user.click(screen.getByRole('button', { name: 'Next' }))

  await waitFor(() =>
    expect(getFilingChangePage).toHaveBeenLastCalledWith(
      'NVDA',
      7,
      expect.objectContaining({ offset: 25 }),
    ),
  )
})

test('changing a filter resets the offset', async () => {
  const user = userEvent.setup()
  vi.mocked(getFilingChanges).mockResolvedValue(comparison())
  vi.mocked(getFilingChangePage).mockResolvedValue(
    page({ items: [change()], total: 60, limit: 25 }),
  )
  renderPanel()
  await expandEvidence()

  await screen.findByText('1–25 of 60')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(getFilingChangePage).toHaveBeenLastCalledWith(
      'NVDA',
      7,
      expect.objectContaining({ offset: 25 }),
    ),
  )

  await user.click(screen.getByLabelText('Section'))
  await user.click(await screen.findByRole('option', { name: 'MD&A' }))

  await waitFor(() =>
    expect(getFilingChangePage).toHaveBeenLastCalledWith(
      'NVDA',
      7,
      expect.objectContaining({ section: 'mda', offset: 0 }),
    ),
  )
})
