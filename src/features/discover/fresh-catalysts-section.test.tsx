import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { FreshCatalystsSection, volumeLabel } from './fresh-catalysts-section'
import { useFreshCatalysts } from './hooks'

vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useFreshCatalysts: vi.fn(),
}))
vi.mock('@/features/research/hooks', () => ({
  useResearchCapabilities: () => ({ data: { swing_research_enabled: true, catalyst_scanner_enabled: true }, isPending: false }),
}))

beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'scrollIntoView') })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks() })

function openCatalysts() {
  fireEvent.click(screen.getByRole('button', { name: /Show all \d+ catalysts/ }))
}

test('pending volume is never a zero-volume observation', () => {
  expect(volumeLabel(null)).toBe('Daily volume confirmation pending')
  expect(volumeLabel(2)).toBe('2.00x daily volume')
})

test('separates headline from observed down move and keeps quote-only volume pending', () => {
  vi.mocked(useFreshCatalysts).mockReturnValue({
    data: {
      items: [
        { candidate_id: 1, ticker: 'ABC', event: { headline: 'ABC wins a major contract', source_url: 'https://example.com/story', source_name: 'Wire', category: 'product_contract_regulatory_approval', published_at: '2026-09-21T12:00:00Z', first_seen_at: '2026-09-21T12:05:00Z', time_status: 'eligible' }, pre_event_close: 50, daily_reaction: { observed_at: '2026-09-21T20:00:00Z', price_basis: 'completed_close', observed_price: 49, reaction_pct: -2, reaction_atr: -0.5, volume_ratio: null, extension: 'small', direction: 'down', elevated_volume: null, reasons: { volume_ratio: 'prior_mean_volume_missing' } }, latest_quote_reaction: null, quality: { status: 'partial', reasons: ['prior_mean_volume_missing'] }, observation_id: 10 },
        { candidate_id: 2, ticker: 'XYZ', event: { headline: 'XYZ releases product', source_url: null, source_name: 'Wire', category: 'product_contract_regulatory_approval', published_at: '2026-09-21T13:00:00Z', first_seen_at: '2026-09-21T13:01:00Z', time_status: 'eligible' }, pre_event_close: 20, daily_reaction: null, latest_quote_reaction: { observed_at: '2026-09-21T14:00:00Z', price_basis: 'quote', observed_price: 20.5, reaction_pct: 2.5, reaction_atr: null, volume_ratio: null, extension: null, direction: 'up', elevated_volume: null, reasons: { volume_ratio: 'session_volume_missing' } }, quality: { status: 'partial', reasons: [] }, observation_id: 11 },
      ],
      total: 2, generated_at: '2026-09-21T14:05:00Z', coverage: { status: 'ok' }, rule_version: 'catalyst-initial-v1', collection_enabled: true,
    }, isPending: false, isError: false,
  } as never)

  renderWithProviders(<FreshCatalystsSection />)
  openCatalysts()
  expect(within(screen.getByRole('dialog')).getByText('ABC wins a major contract')).toBeInTheDocument()
  expect(within(screen.getByRole('dialog')).getByText(/-2.00%/)).toBeInTheDocument()
  expect(screen.getByText(/Daily volume comparison unavailable/)).toBeInTheDocument()
  expect(within(screen.getByRole('dialog')).getByText(/Daily volume confirmation pending/)).toBeInTheDocument()
  expect(screen.getByText(/Quote at/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Wire' })).toHaveAttribute('href', 'https://example.com/story')
  fireEvent.change(screen.getByLabelText('Observed direction'), { target: { value: 'down' } })
  expect(useFreshCatalysts).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'down' }), true)
})

const intradayItem = {
  candidate_id: 3, ticker: 'QQQ',
  event: { headline: 'QQQ approval', source_url: null, source_name: 'Wire', category: 'product_contract_regulatory_approval', published_at: '2026-09-23T14:07:00Z', first_seen_at: '2026-09-23T14:08:00Z', time_status: 'eligible' },
  pre_event_close: 10, daily_reaction: null, latest_quote_reaction: null,
  quality: { status: 'ok', reasons: [] }, observation_id: null,
}

function listing(items: unknown[]) {
  return {
    data: { items, total: items.length, generated_at: null, coverage: { status: 'ok' }, rule_version: 'catalyst-initial-v1', collection_enabled: true },
    isPending: false, isError: false,
  } as never
}

test('intraday evidence appears only when the extension supplied it', () => {
  vi.mocked(useFreshCatalysts).mockReturnValue(listing([{ ...intradayItem, intraday: null }]))
  renderWithProviders(<FreshCatalystsSection />)
  openCatalysts()
  expect(screen.queryByText(/same-time volume/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /5-minute/i })).not.toBeInTheDocument()
})

test('too few comparable sessions and the reference close are labelled', () => {
  vi.mocked(useFreshCatalysts).mockReturnValue(listing([{
    ...intradayItem,
    intraday: {
      subscription_id: 7, collecting: true, coverage: { status: 'ok' },
      same_time_volume: { value: null, status: 'unavailable', reason: 'insufficient_baseline_sessions', session: '2026-09-23', cutoff_at: '2026-09-23T14:30:00Z', lag_minutes: 0, sample_sessions: 8, minimum_sessions: 10, interval: '5m' },
      pre_publication_reference: { close: 9.8, bar_end_at: '2026-09-23T14:05:00Z', basis: 'reference_only' },
    },
  }]))
  renderWithProviders(<FreshCatalystsSection />)
  openCatalysts()
  expect(screen.getByText(/8 of 10 comparable sessions/)).toBeInTheDocument()
  expect(screen.getByText(/Pre-publication 5-minute close \$9.80/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop 5-minute collection' })).toBeInTheDocument()
})

test('an uncollected catalyst offers explicit collection', () => {
  vi.mocked(useFreshCatalysts).mockReturnValue(listing([{
    ...intradayItem,
    intraday: { subscription_id: null, collecting: false, coverage: null, same_time_volume: null, pre_publication_reference: null },
  }]))
  renderWithProviders(<FreshCatalystsSection />)
  openCatalysts()
  expect(screen.getByRole('button', { name: 'Collect 5-minute bars' })).toBeInTheDocument()
  expect(within(screen.getByRole('listitem')).getByText('Product, contract & approval')).toBeInTheDocument()
})


test('three compact chips preview the first page and Show all retains every loaded card', () => {
  vi.mocked(useFreshCatalysts).mockReturnValue(listing(['AAA', 'BBB', 'CCC', 'DDD'].map((ticker, index) => ({
    ...intradayItem, candidate_id: index + 1, ticker, event: { ...intradayItem.event, headline: `${ticker} contract` },
  }))))
  renderWithProviders(<FreshCatalystsSection />)
  expect(screen.getAllByRole('button', { name: /^View .* catalyst:/ })).toHaveLength(3)
  expect(screen.queryByText('DDD contract')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Catalyst age')).not.toBeInTheDocument()
  openCatalysts()
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByText('DDD contract')).toBeInTheDocument()
  expect(dialog.getByLabelText('Catalyst age')).toHaveValue('72')
  expect(dialog.getAllByRole('link', { name: /AAA|BBB|CCC|DDD/ })).toHaveLength(4)
})

test('chip opens its selected event and Escape restores focus', async () => {
  const user = userEvent.setup()
  vi.mocked(useFreshCatalysts).mockReturnValue(listing([intradayItem]))
  renderWithProviders(<FreshCatalystsSection />)
  const chip = screen.getByRole('button', { name: 'View QQQ catalyst: QQQ approval' })
  await user.click(chip)
  expect(screen.getByRole('dialog').querySelector('[data-highlighted=true]')).not.toBeNull()
  await waitFor(() => expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start' }))
  await user.keyboard('{Escape}')
  await waitFor(() => expect(chip).toHaveFocus())
})

test('fast tooltip includes publication, source and data limits without opening a card', async () => {
  const user = userEvent.setup()
  vi.mocked(useFreshCatalysts).mockReturnValue(listing([{ ...intradayItem, quality: { status: 'partial', reasons: ['prior_mean_volume_missing'] } }]))
  renderWithProviders(<FreshCatalystsSection />)
  await user.hover(screen.getByRole('button', { name: 'View QQQ catalyst: QQQ approval' }))
  const tooltip = within(await screen.findByRole('tooltip'))
  expect(tooltip.getByText('QQQ approval')).toBeInTheDocument()
  expect(tooltip.getByText(/Wire · Published/)).toBeInTheDocument()
  expect(tooltip.getByText(/First seen/)).toBeInTheDocument()
  expect(tooltip.getByText(/Data limits: prior mean volume missing/)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('empty filtered results still allow opening filters', () => {
  vi.mocked(useFreshCatalysts).mockReturnValue(listing([]))
  renderWithProviders(<FreshCatalystsSection />)
  fireEvent.click(screen.getByRole('button', { name: 'Browse catalysts' }))
  expect(screen.getByLabelText('Catalyst age')).toBeInTheDocument()
  expect(within(screen.getByRole('dialog')).getByText('No recent material events match these filters.')).toBeInTheDocument()
})

test('panel pagination leaves the preview query on page one', () => {
  const data = listing([intradayItem]) as unknown as { data: { total: number } }
  data.data.total = 22
  vi.mocked(useFreshCatalysts).mockReturnValue(data as never)
  renderWithProviders(<FreshCatalystsSection />)
  openCatalysts()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(useFreshCatalysts).toHaveBeenNthCalledWith(vi.mocked(useFreshCatalysts).mock.calls.length - 1,
    expect.objectContaining({ page: 1 }), true)
  expect(useFreshCatalysts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), true)
  expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
})

test('opening a preview chip resets pagination and keeps its selection until filters change', () => {
  vi.mocked(useFreshCatalysts).mockReturnValue(listing([intradayItem]))
  renderWithProviders(<FreshCatalystsSection />, ['/discover?catalyst_page=2'])
  fireEvent.click(screen.getByRole('button', { name: 'View QQQ catalyst: QQQ approval' }))
  expect(useFreshCatalysts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), true)
  expect(screen.getByRole('dialog').querySelector('[data-highlighted=true]')).not.toBeNull()
  fireEvent.change(screen.getByLabelText('Catalyst age'), { target: { value: '24' } })
  expect(useFreshCatalysts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, ageHours: 24 }), true)
  expect(screen.getByRole('dialog').querySelector('[data-highlighted=true]')).toBeNull()
})
