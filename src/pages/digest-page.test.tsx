import { cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { DigestPage } from './digest-page'
import type {
  DigestDeliveryOut,
  DigestItem,
  DigestOut,
  DigestPayload,
  TelegramStatusOut,
} from '@/types/api'
import type { ResearchFirstReport } from '@/features/research-first/types'

function digestItem(overrides: Partial<DigestItem>): DigestItem {
  return {
    ticker: 'AAA',
    tier: 1,
    reasons: ['8-K filed'],
    stages: [],
    premarket: null,
    premarket_gap_pct: null,
    volume_ratio: null,
    pct_from_12wk_avg: null,
    recent_pattern: null,
    top_filing: null,
    top_earnings: null,
    news_count_24h: 0,
    headline_snippets: [],
    sentiment: null,
    ...overrides,
  }
}

let items: DigestItem[]
const sendMutate = vi.fn()
let sendState: {
  mutate: typeof sendMutate
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  data?: DigestDeliveryOut
  error?: Error
}
let telegram: TelegramStatusOut

let intraday: DigestOut | null
let morningMeta: Partial<DigestOut>
let researchFirst: DigestPayload['research_first']
const buildMutate = vi.fn()
const digestCalls: string[] = []

vi.mock('@/features/digest/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/digest/hooks')>()),
  useDigest: (edition: 'morning' | 'intraday') => {
    digestCalls.push(edition)
    return {
      data:
        edition === 'morning'
          ? {
              digest_date: '2026-09-06',
              generated_at: '2026-09-06T11:45:00Z',
              payload: { digest_date: '2026-09-06', generated_at: '2026-09-06T11:45:00Z', items, research_first: researchFirst },
              ...morningMeta,
            }
          : intraday,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }
  },
  useBuildDigest: () => ({ mutate: buildMutate, isPending: false }),
  useSendMorningDigest: () => sendState,
}))

vi.mock('@/features/watchlists/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/watchlists/hooks')>()),
  useTelegramStatus: () => ({ data: telegram }),
}))

beforeEach(() => {
  items = [digestItem({})]
  intraday = null
  morningMeta = { edition: 'late', snapshot_id: 7, capture_completed_at: '2026-09-06T13:06:00Z', preliminary: false }
  researchFirst = undefined
  buildMutate.mockReset()
  digestCalls.length = 0
  sendMutate.mockReset()
  sendState = { mutate: sendMutate, isPending: false, isSuccess: false, isError: false }
  telegram = { configured: true, ready: true, error: null, digest_enabled: true }
})

afterEach(cleanup)

test('sends the digest to Telegram when the button is clicked', async () => {
  const user = userEvent.setup()
  renderWithProviders(<DigestPage />)

  await user.click(screen.getByRole('button', { name: /send to telegram/i }))

  expect(sendMutate).toHaveBeenCalledTimes(1)
})

test('disables the send button when Telegram is not ready', () => {
  telegram = { configured: false, ready: false, error: 'not configured', digest_enabled: false }
  renderWithProviders(<DigestPage />)

  expect(screen.getByRole('button', { name: /send to telegram/i })).toBeDisabled()
})

test('reports how many messages were delivered', () => {
  sendState = {
    ...sendState,
    isSuccess: true,
    data: {
      digest_date: '2026-09-06',
      slot: 'manual',
      status: 'sent',
      message_count: 4,
      messages_sent: 4,
      last_error: null,
      skipped: false,
    },
  }
  renderWithProviders(<DigestPage />)

  expect(screen.getByTestId('digest-send-result')).toHaveTextContent('Sent 4 of 4 messages')
})

test('explains a skipped send instead of reporting success', () => {
  sendState = {
    ...sendState,
    isSuccess: true,
    data: {
      digest_date: '2026-09-06',
      slot: 'manual',
      status: 'sent',
      message_count: 4,
      messages_sent: 0,
      last_error: null,
      skipped: true,
    },
  }
  renderWithProviders(<DigestPage />)

  expect(screen.getByTestId('digest-send-result')).toHaveTextContent(/already sent/i)
})

test('notes when scheduled Telegram delivery is switched off', () => {
  telegram = { configured: true, ready: true, error: null, digest_enabled: false }
  renderWithProviders(<DigestPage />)

  expect(screen.getByTestId('digest-schedule-note')).toHaveTextContent(
    /scheduled telegram delivery/i,
  )
})

test('hides the scheduled-delivery note when the bursts are on', () => {
  renderWithProviders(<DigestPage />)

  expect(screen.queryByTestId('digest-schedule-note')).not.toBeInTheDocument()
})

test('shows score leaders and laggards as a labelled, expanded section', () => {
  // This section used to read "Tracked" and start collapsed, as if nothing in
  // it mattered; in a built digest it holds only the score extremes.
  items = [
    digestItem({
      ticker: 'TOPS',
      section: 'score_extreme',
      tier: 11,
      reasons: ['Top-15 composite score 82.5 (bullish)'],
      stages: ['score_leader'],
    }),
    digestItem({
      ticker: 'LAGS',
      section: 'score_extreme',
      tier: 11,
      reasons: ['Bottom-15 composite score 32.8 (bearish)'],
      stages: ['score_laggard'],
    }),
  ]
  renderWithProviders(<DigestPage />)

  expect(screen.getByRole('heading', { name: /score leaders & laggards/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'LAGS' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /score laggard \(1\)/i })).toBeInTheDocument()
})

test('labels the pattern tier for both ends of the 12-week range', () => {
  items = [
    digestItem({
      ticker: 'TOPPY',
      section: 'pattern_extreme',
      tier: 7,
      reasons: ['Head and shoulders top pattern detected near 12-week high'],
      stages: ['bearish_pattern'],
      pct_from_12wk_avg: 18,
      recent_pattern: {
        label: 'Head and shoulders top',
        confidence: 0.71,
        bias: 'bearish',
        description: 'd',
      },
    }),
  ]
  renderWithProviders(<DigestPage />)

  expect(
    screen.getByRole('heading', { name: /pattern near 12-week low\/high/i }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /bearish pattern \(1\)/i })).toBeInTheDocument()
})

test('renders sections by name in the order the digest ranked them', () => {
  items = [
    digestItem({ ticker: 'GAPPY', section: 'premarket_gap', tier: 3, reasons: ['Premarket up'] }),
    digestItem({ ticker: 'LOWW', section: 'near_low', tier: 9, reasons: ['Near 12-week low'] }),
  ]
  renderWithProviders(<DigestPage />)

  const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
  const gap = headings.findIndex((text) => /premarket gap/i.test(text))
  const low = headings.findIndex((text) => /near 12-week low/i.test(text))
  expect(gap).toBeGreaterThanOrEqual(0)
  expect(gap).toBeLessThan(low)
})

test('labels a digest stored before sections existed by its old tier number', () => {
  // The old numbering had strong sentiment at tier 7 and the gap at tier 8.
  items = [digestItem({ ticker: 'OLD', tier: 7, reasons: ['Strongly negative news'] })]
  renderWithProviders(<DigestPage />)

  expect(screen.getByRole('heading', { name: /strong sentiment/i })).toBeInTheDocument()
})

test('marks slow-list entries that are new since the last digest', () => {
  items = [
    digestItem({
      ticker: 'NEWLOW',
      section: 'near_low',
      tier: 9,
      new_today: true,
      reasons: ['Near 12-week low (-20.0% vs 12wk avg)'],
    }),
    digestItem({
      ticker: 'OLDLOW',
      section: 'near_low',
      tier: 9,
      new_today: false,
      reasons: ['Near 12-week low (-30.0% vs 12wk avg)'],
    }),
  ]
  renderWithProviders(<DigestPage />)

  expect(screen.getAllByText('New')).toHaveLength(1)
})

function shortlist(tickers: string[]): ResearchFirstReport {
  return {
    rule_version: 'research-first-v4', generated_at: '2026-09-06T11:45:00Z',
    window: { starts_at: '2026-09-06T11:45:00Z', anchor_session: '2026-09-04', horizon_sessions: 5,
      expires_at: '2026-09-11T20:00:00Z', expires_on: '2026-09-11', calendar: 'XNYS', window_version: 'swing-window-v1' },
    eligible_tickers: tickers.length, coverage: { status: 'complete' }, collection_enabled: true,
    items: tickers.map((ticker, index) => ({
      rank: index + 1, ticker, company_name: null, candidate_id: index + 1,
      headline: `${ticker} research headline`, category: 'earnings_guidance', published_at: '2026-09-06T10:00:00Z',
      source_url: null, source_name: 'Issuer', priority_points: 2, ranking: [],
      composite_score: null, lean: null, score_updated_at: null, observed_direction: null, reaction_atr: null,
      volume_ratio: null, reaction_observed_at: null, earnings_date: null, earnings_timing: null,
      earnings_overlap: null, selected_volatility: null, supporting_evidence: [], risks: [], data_limits: [],
    })),
  }
}

function gappers(count: number): DigestItem[] {
  return Array.from({ length: count }, (_, index) =>
    digestItem({
      ticker: `G${String(index).padStart(2, '0')}`,
      section: 'premarket_gap',
      tier: 3,
      reasons: [`Premarket up +${index + 3}.0%`],
      stages: ['premarket_gap'],
    }),
  )
}

test('shows three Research First cards and at most twelve other cards until expanded', async () => {
  const user = userEvent.setup()
  items = [
    ...gappers(15),
    digestItem({ ticker: 'RTN', section: 'other_filings', tier: 13, reasons: ['Reg FD'], stages: ['filing'] }),
  ]
  researchFirst = { '5': shortlist(['G00', 'G01', 'G02', 'R04']) }
  renderWithProviders(<DigestPage />)

  // G00-G02 are already Research First cards, so they are not repeated.
  expect(screen.queryByRole('link', { name: 'G00' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'G03' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'G14' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'RTN' })).not.toBeInTheDocument()
  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 12 of 16 tickers')

  const expand = screen.getByRole('button', { name: /show all coverage/i })
  expect(expand).toHaveAttribute('aria-expanded', 'false')
  await user.click(expand)

  expect(expand).toHaveAttribute('aria-expanded', 'true')
  // Full coverage is one ranked list: each section appears once.
  expect(screen.getAllByRole('heading', { name: /premarket gap/i })).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'G00' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'RTN' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /other filings/i })).toBeInTheDocument()
  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 16 of 16 tickers')
})

test('a stage filter shows every match and clearing it restores the compact view', async () => {
  const user = userEvent.setup()
  items = gappers(15)
  researchFirst = { '5': shortlist(['G00', 'G01', 'G02']) }
  renderWithProviders(<DigestPage />)

  await user.click(screen.getByRole('button', { name: /premarket gap \(15\)/i }))

  expect(screen.getByRole('link', { name: 'G00' })).toBeInTheDocument()
  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 15 of 15 tickers')
  expect(screen.queryByRole('button', { name: /show all coverage/i })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Clear' }))

  expect(screen.queryByRole('link', { name: 'G00' })).not.toBeInTheDocument()
  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 12 of 15 tickers')
})

test('switching the Research First horizon recomputes the exclusions', async () => {
  items = gappers(15)
  researchFirst = { '5': shortlist(['G00', 'G01', 'G02']), '1': shortlist(['G10']) }
  renderWithProviders(<DigestPage />)

  expect(screen.queryByRole('link', { name: 'G00' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Research horizon'), { target: { value: '1' } })

  expect(await screen.findByRole('link', { name: 'G00' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'G10' })).not.toBeInTheDocument()
})

test('building an update switches to the intraday view and keeps the morning intact', async () => {
  const user = userEvent.setup()
  items = [digestItem({ ticker: 'MORN', section: 'premarket_gap', reasons: ['Premarket up +5.0%'] })]
  intraday = {
    digest_date: '2026-09-06', generated_at: '2026-09-06T14:12:00Z', edition: 'intraday', snapshot_id: 9,
    capture_completed_at: '2026-09-06T14:13:00Z', preliminary: false,
    payload: { digest_date: '2026-09-06', generated_at: '2026-09-06T14:12:00Z',
      items: [digestItem({ ticker: 'INTRA', section: 'filing' })] },
  }
  buildMutate.mockImplementation((_vars: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.())
  renderWithProviders(<DigestPage />)

  await user.click(screen.getByRole('button', { name: 'Build update' }))

  expect(screen.getByRole('button', { name: 'Intraday' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('link', { name: 'INTRA' })).toBeInTheDocument()
  expect(screen.getByTestId('digest-edition-label')).toHaveTextContent(/intraday update/i)
  // Intraday never offers an ambiguous Telegram send.
  expect(screen.queryByRole('button', { name: /send to telegram/i })).not.toBeInTheDocument()
  expect(screen.getByTestId('digest-intraday-send-note')).toHaveTextContent(/sends the morning edition/i)

  await user.click(screen.getByRole('button', { name: 'Morning' }))

  expect(screen.getByRole('link', { name: 'MORN' })).toBeInTheDocument()
  expect(screen.getByTestId('digest-edition-label')).toHaveTextContent(/late edition/i)
  expect(screen.getByRole('button', { name: /send to telegram/i })).toBeInTheDocument()
  expect(digestCalls).toContain('intraday')
})

test('a missing intraday update has its own empty state', async () => {
  const user = userEvent.setup()
  renderWithProviders(<DigestPage />)

  await user.click(screen.getByRole('button', { name: 'Intraday' }))

  expect(screen.getByText(/no intraday update yet/i)).toBeInTheDocument()
})

test('labels a preliminary early edition and a legacy digest with their capture times', () => {
  morningMeta = { edition: 'early', snapshot_id: 3, capture_completed_at: '2026-09-06T11:46:00Z', preliminary: true }
  const { unmount } = renderWithProviders(<DigestPage />)

  expect(screen.getByTestId('digest-edition-label')).toHaveTextContent(/preliminary early edition/i)
  expect(screen.getByTestId('digest-edition-label')).toHaveTextContent(/captured/i)
  unmount()

  morningMeta = { edition: 'legacy', snapshot_id: null, capture_completed_at: '2026-09-06T14:18:00Z', preliminary: false }
  renderWithProviders(<DigestPage />)

  expect(screen.getByTestId('digest-edition-label')).toHaveTextContent(/legacy digest/i)
})

test('a digest without edition metadata still renders', () => {
  morningMeta = { edition: undefined, snapshot_id: undefined, capture_completed_at: undefined, preliminary: undefined }
  renderWithProviders(<DigestPage />)

  expect(screen.getByRole('link', { name: 'AAA' })).toBeInTheDocument()
})

test('clearing a stage filter returns to the compact view even after expanding', async () => {
  const user = userEvent.setup()
  items = gappers(15)
  researchFirst = { '5': shortlist(['G00', 'G01', 'G02']) }
  renderWithProviders(<DigestPage />)

  await user.click(screen.getByRole('button', { name: /show all coverage/i }))
  await user.click(screen.getByRole('button', { name: /premarket gap \(15\)/i }))
  await user.click(screen.getByRole('button', { name: 'Clear' }))

  expect(screen.getByTestId('digest-coverage-count')).toHaveTextContent('Showing 12 of 15 tickers')
  expect(screen.queryByRole('link', { name: 'G00' })).not.toBeInTheDocument()
})
