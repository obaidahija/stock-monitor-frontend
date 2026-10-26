import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { getAiResearch, refreshAiResearch } from '@/api/stocks'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { AiResearchOut } from '@/types/api'
import { AiResearchTab } from './ai-research-tab'

vi.mock('@/api/stocks', () => ({
  getAiResearch: vi.fn(),
  refreshAiResearch: vi.fn(),
  askGoogleFinanceResearch: vi.fn(),
}))
// Live progress is a WebSocket side channel; the HTTP response carries the result.
vi.mock('./progress-panel', () => ({ ProgressPanel: () => null }))
vi.mock('@/features/watchlists/save-ai-setup-dialog', () => ({
  SaveAiSetupDialog: ({ data }: { data: AiResearchOut }) => (
    <span>
      Save setup from {data.ticker} report {data.snapshot_id}
    </span>
  ),
}))

afterEach(cleanup)

function report(ticker: string, summary: string | null, overrides: Partial<AiResearchOut> = {}): AiResearchOut {
  return {
    snapshot_id: 1,
    ticker,
    score: 62,
    confidence: 70,
    lean: 'bullish',
    summary,
    key_drivers: [],
    risks: [],
    price_reference: null,
    inputs_used: {
      news_item_ids: [],
      news_item_count: 0,
      twitter_post_ids: [],
      twitter_post_count: 0,
      twitter_cache_is_fresh: false,
      twitter_cache_age_seconds: null,
      reddit_post_ids: [],
      reddit_post_count: 0,
      reddit_cache_is_fresh: false,
      reddit_cache_age_seconds: null,
      quant_facts: [],
    },
    caveat: 'Informational only.',
    source: { ok: true, error: null },
    generated_at: '2026-10-23T14:00:00Z',
    cached: false,
    current_price: 100,
    usage: null,
    ...overrides,
  }
}

function requestedTickers() {
  return vi.mocked(getAiResearch).mock.calls.map(([ticker]) => ticker)
}

function clickGenerate() {
  fireEvent.click(screen.getByRole('button', { name: /Generate AI research/ }))
}

test('renders the structured report above the Google Finance card', () => {
  renderWithProviders(<AiResearchTab ticker="MSTR" />)

  const googleCard = screen.getByText('Google Finance Research')
  const reportHeading = screen.getByRole('heading', { name: 'MarketScout Structured Report' })

  expect(
    reportHeading.compareDocumentPosition(googleCard) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ask Google Finance' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Generate AI research/ })).toBeInTheDocument()
})

test('describes provider and cache dependent generation time without a fixed promise', () => {
  renderWithProviders(<AiResearchTab ticker="MSTR" />)

  expect(
    screen.getByText(
      'Generation time depends on the selected AI provider, available evidence, and whether source caches are warm.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByText(/takes 20-60s/i)).not.toBeInTheDocument()
})

test('generation waits for the button and its read can be cancelled', async () => {
  vi.mocked(getAiResearch).mockResolvedValue(report('AAA', 'A summary'))
  renderWithProviders(<AiResearchTab ticker="AAA" />)
  await act(async () => {})
  expect(getAiResearch).not.toHaveBeenCalled()

  clickGenerate()

  expect(await screen.findByText('A summary')).toBeInTheDocument()
  expect(getAiResearch).toHaveBeenCalledTimes(1)
  expect(getAiResearch).toHaveBeenCalledWith('AAA', expect.any(AbortSignal))
})

test('back navigation cannot show B research on A', async () => {
  vi.mocked(getAiResearch).mockImplementation(async (ticker) =>
    ticker === 'AAA'
      ? report('AAA', 'A summary', { snapshot_id: 1 })
      : report('BBB', 'B summary', { snapshot_id: 2 }),
  )
  vi.mocked(refreshAiResearch).mockResolvedValue(
    report('BBB', 'B refreshed', { snapshot_id: 3, generated_at: '2026-10-23T15:00:00Z' }),
  )
  const { rerender } = renderWithProviders(<AiResearchTab ticker="AAA" />)
  clickGenerate()
  expect(await screen.findByText('A summary')).toBeInTheDocument()

  rerender(<AiResearchTab ticker="BBB" />)
  await act(async () => {})
  expect(requestedTickers()).toEqual(['AAA'])
  expect(screen.queryByText('A summary')).not.toBeInTheDocument()
  clickGenerate()
  expect(await screen.findByText('B summary')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('B refreshed')).toBeInTheDocument()

  rerender(<AiResearchTab ticker="AAA" />)
  await act(async () => {})
  expect(screen.getByText('A summary')).toBeInTheDocument()
  expect(screen.getByText('Save setup from AAA report 1')).toBeInTheDocument()
  expect(screen.queryByText('B refreshed')).not.toBeInTheDocument()
  expect(requestedTickers()).toEqual(['AAA', 'BBB'])
})

test('leaving during generation never generates for the next ticker', async () => {
  vi.mocked(getAiResearch).mockReturnValue(new Promise(() => {}))
  const { rerender } = renderWithProviders(<AiResearchTab ticker="AAA" />)
  clickGenerate()
  expect(await screen.findByRole('button', { name: /Generating/ })).toBeDisabled()

  rerender(<AiResearchTab ticker="BBB" />)
  await act(async () => {})

  expect(screen.getByRole('button', { name: /Generate AI research/ })).toBeEnabled()
  expect(requestedTickers()).toEqual(['AAA'])
})

test('failed refresh preserves successful report', async () => {
  vi.mocked(getAiResearch).mockResolvedValue(report('AAA', 'A summary'))
  vi.mocked(refreshAiResearch).mockResolvedValue(
    report('AAA', null, {
      snapshot_id: null,
      lean: null,
      score: null,
      confidence: null,
      source: { ok: false, error: 'LLM timed out' },
      generated_at: '2026-10-23T15:00:00Z',
    }),
  )
  renderWithProviders(<AiResearchTab ticker="AAA" />)
  clickGenerate()
  expect(await screen.findByText('A summary')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

  expect(await screen.findByText("Couldn't refresh AI research: LLM timed out")).toBeInTheDocument()
  expect(screen.getByText('A summary')).toBeInTheDocument()
  expect(screen.getByText('Save setup from AAA report 1')).toBeInTheDocument()
})

test('a refresh answered with another ticker never shows that report', async () => {
  vi.mocked(getAiResearch).mockResolvedValue(report('AAA', 'A summary'))
  vi.mocked(refreshAiResearch).mockResolvedValue(
    report('BBB', 'B summary', { snapshot_id: 9, generated_at: '2026-10-23T15:00:00Z' }),
  )
  renderWithProviders(<AiResearchTab ticker="AAA" />)
  clickGenerate()
  expect(await screen.findByText('A summary')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

  expect(await screen.findByText(/Couldn't refresh AI research/)).toBeInTheDocument()
  expect(screen.queryByText('B summary')).not.toBeInTheDocument()
  expect(screen.getByText('Save setup from AAA report 1')).toBeInTheDocument()
})

test('a failed initial generation retries on click', async () => {
  vi.mocked(getAiResearch)
    .mockRejectedValueOnce(new ApiError(500, 'boom'))
    .mockResolvedValueOnce(report('AAA', 'A summary'))
  renderWithProviders(<AiResearchTab ticker="AAA" />)
  clickGenerate()
  expect(await screen.findByText("Couldn't generate AI research for AAA.")).toBeInTheDocument()

  clickGenerate()

  expect(await screen.findByText('A summary')).toBeInTheDocument()
  expect(getAiResearch).toHaveBeenCalledTimes(2)
})
