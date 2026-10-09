import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import { ShortSqueezeSection } from './short-squeeze-section'
import { useShortSqueezeDetail, useShortSqueezes } from './short-squeeze-hooks'
import { conditions, squeezeItem, squeezeList } from './short-squeeze.test-helpers'

const capabilities = vi.hoisted(() => ({ scanner: true as boolean | undefined, loaded: true }))

vi.mock('./short-squeeze-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./short-squeeze-hooks')>()),
  useShortSqueezes: vi.fn(),
  useShortSqueezeDetail: vi.fn(),
}))

vi.mock('@/features/research/hooks', () => ({
  useResearchCapabilities: () => ({
    data: capabilities.loaded
      ? {
          swing_research_enabled: true,
          research_outcomes_v2_enabled: true,
          catalyst_scanner_enabled: false,
          follow_through_enabled: false,
          event_window_v2_enabled: false,
          research_intraday_enabled: false,
          ...(capabilities.scanner === undefined
            ? {}
            : { short_squeeze_scanner_enabled: capabilities.scanner }),
        }
      : undefined,
    isPending: !capabilities.loaded,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  capabilities.scanner = true
  capabilities.loaded = true
})

function listing(data: ReturnType<typeof squeezeList> | undefined, extra: object = {}) {
  vi.mocked(useShortSqueezes).mockReturnValue({
    data,
    isPending: data === undefined,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...extra,
  } as never)
  vi.mocked(useShortSqueezeDetail).mockReturnValue({ data: undefined, isPending: true } as never)
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>
}

test('stays hidden until capabilities resolve', () => {
  capabilities.loaded = false
  listing(squeezeList())
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.queryByRole('region', { name: 'Short Squeeze Strategy' })).not.toBeInTheDocument()
})

test('an older backend without the capability field reads as disabled', () => {
  capabilities.scanner = undefined
  listing(squeezeList({ items: [], publication_id: null, data_status: 'not_collected' }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.queryByRole('region', { name: 'Short Squeeze Strategy' })).not.toBeInTheDocument()
})

test('keeps_zero_match_coverage_visible', () => {
  listing(squeezeList({ items: [] }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByRole('region', { name: 'Short Squeeze Strategy' })).toBeInTheDocument()
  expect(screen.getByText(/0 matched/)).toBeInTheDocument()
  expect(screen.getByText(/900 evaluated/)).toBeInTheDocument()
  expect(screen.getByText(/18 incomplete/)).toBeInTheDocument()
  expect(screen.getByText(/No stocks met every condition/)).toBeInTheDocument()
})

test('states the rule and the daily session it describes', () => {
  listing(squeezeList())
  renderWithProviders(<ShortSqueezeSection />)
  expect(
    screen.getByText('Short float >7% + days to cover >5 + (>7% gain OR close at/above prior high)'),
  ).toBeInTheDocument()
  expect(screen.getByText(/Daily session: Oct 5, 2026/)).toBeInTheDocument()
})

test('not-collected state explains that nothing has been published yet', () => {
  listing(
    squeezeList({
      items: [],
      publication_id: null,
      generated_at: null,
      published_at: null,
      signal_session: null,
      data_status: 'not_collected',
    }),
  )
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText(/No scan has been published yet/)).toBeInTheDocument()
})

test('a stale publication is labelled with its reasons', () => {
  listing(squeezeList({ stale: true, data_status: 'stale', stale_reasons: ['latest_scan_failed'] }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText('Stale')).toBeInTheDocument()
  expect(screen.getByText(/latest scan failed/)).toBeInTheDocument()
})

test('disabled collection keeps cached results inspectable', () => {
  capabilities.scanner = false
  listing(squeezeList({ collection_enabled: false }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText(/Collection off · cached results/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Inspect SQZ' })).toBeInTheDocument()
})

test('disabled collection with nothing cached stays out of the way', () => {
  capabilities.scanner = false
  listing(squeezeList({ items: [], publication_id: null, data_status: 'not_collected', collection_enabled: false }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.queryByRole('region', { name: 'Short Squeeze Strategy' })).not.toBeInTheDocument()
})

test('errors render with a retry', () => {
  const refetch = vi.fn()
  listing(undefined, { isPending: false, isError: true, error: new Error('scan unavailable'), refetch })
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText('scan unavailable')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(refetch).toHaveBeenCalled()
})

test('a gain match that touched the prior high and gave it back says so', () => {
  listing(squeezeList({ items: [squeezeItem({ high_touched: true, close_gap_to_high_pct: -8.33 })] }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText('Daily gain')).toBeInTheDocument()
  expect(screen.getByText('High touched; closed below')).toBeInTheDocument()
})

test('a matched row exposes its unavailable history without opening Inspect', () => {
  listing(squeezeList({ items: [squeezeItem({ quality_reasons: ['high_listing_too_young'] })] }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText(/Data limits: Insufficient listing history/)).toBeInTheDocument()
  expect(screen.getByText('Daily gain')).toBeInTheDocument()
})

test('stale short-interest values carry the stale report date in the row', () => {
  listing(squeezeList({ items: [squeezeItem({
    status: 'incomplete', short_report_date: '2018-08-31',
    quality_reasons: ['short_report_date_stale'],
    conditions: conditions({
      short_float: { state: 'unknown', value: null, threshold: 7, comparison: '>', reason: 'short_report_date_stale' },
      days_to_cover: { state: 'unknown', value: null, threshold: 5, comparison: '>', reason: 'short_report_date_stale' },
    }),
  })] }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText(/Short-interest report is stale.*Aug 31, 2018/)).toBeInTheDocument()
})

test('derived short float is explicitly labelled as an estimate', () => {
  listing(squeezeList({ items: [squeezeItem({ short_float_source: 'derived_shares_short_over_float' })] }))
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText(/Estimated short float/)).toBeInTheDocument()
})

test('a close at the prior high is named', () => {
  listing(
    squeezeList({
      items: [
        squeezeItem({
          move_pct: 4.3,
          high_touched: true,
          close_gap_to_high_pct: 0,
          conditions: conditions({
            daily_gain: { state: 'fail', value: 4.3, threshold: 7, comparison: '>', reason: null },
            high_close: { state: 'pass', value: 12, threshold: 12, comparison: '>=', reason: null },
          }),
        }),
      ],
    }),
  )
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText('Closed at prior high')).toBeInTheDocument()
  expect(screen.queryByText('High touched; closed below')).not.toBeInTheDocument()
})

test('a session passing both branches names both', () => {
  listing(
    squeezeList({
      items: [
        squeezeItem({
          high_touched: true,
          close_gap_to_high_pct: 1.5,
          conditions: conditions({
            high_close: { state: 'pass', value: 12.18, threshold: 12, comparison: '>=', reason: null },
          }),
        }),
      ],
    }),
  )
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText('Daily gain + closed at prior high')).toBeInTheDocument()
  expect(screen.queryByText('High touched; closed below')).not.toBeInTheDocument()
})

test('shows_unknown_report_date', () => {
  listing(squeezeList({ items: [squeezeItem({ short_report_date: null, quality_reasons: ['report_date_unknown'] })] }))
  renderWithProviders(<ShortSqueezeSection />)
  // unknown report date is not described as current
  expect(screen.getByText('Short-interest report date unavailable')).toBeInTheDocument()
})

test('volume is a labelled completed-session fact, never a threshold', () => {
  listing(squeezeList())
  renderWithProviders(<ShortSqueezeSection />)
  expect(screen.getByText('Completed session volume 2.50x')).toBeInTheDocument()
})

test('numbers use fixed decimals and unknown values show a dash', () => {
  listing(
    squeezeList({
      items: [
        squeezeItem({ ticker: 'AAA', evaluation_id: 1, move_pct: 8, short_percent_of_float: 12.345, short_ratio: 6 }),
        squeezeItem({
          ticker: 'BBB',
          evaluation_id: 2,
          status: 'incomplete',
          move_pct: null,
          short_percent_of_float: null,
          short_ratio: null,
          relative_volume: null,
          quality_reasons: ['high_history_incomplete'],
          conditions: conditions({
            high_close: { state: 'unknown', value: null, threshold: null, comparison: '>=', reason: 'high_history_incomplete' },
            price_strength: { state: 'unknown', value: null, threshold: null, comparison: 'any', reason: 'price_branch_unknown' },
          }),
        }),
      ],
    }),
  )
  renderWithProviders(<ShortSqueezeSection />)
  const first = screen.getByRole('row', { name: /AAA/ })
  expect(first).toHaveTextContent('+8.00%')
  expect(first).toHaveTextContent('12.3%')
  expect(first).toHaveTextContent('6.0')
  const second = screen.getByRole('row', { name: /BBB/ })
  expect(second).toHaveTextContent('—')
  expect(second).toHaveTextContent('Incomplete')
  expect(second).toHaveTextContent('high history incomplete')
})

test('changing the status keeps other Discover params and resets only the squeeze page', () => {
  listing(squeezeList())
  renderWithProviders(
    <>
      <ShortSqueezeSection />
      <LocationProbe />
    </>,
    ['/?catalyst_age=48&horizon_sessions=3&squeeze_sort=ticker&squeeze_page=2'],
  )
  expect(useShortSqueezes).toHaveBeenLastCalledWith(
    { status: 'matched', sort: 'ticker', page: 2, pageSize: 10 },
    true,
  )
  fireEvent.change(screen.getByLabelText('Short squeeze status'), { target: { value: 'incomplete' } })

  expect(useShortSqueezes).toHaveBeenLastCalledWith(
    { status: 'incomplete', sort: 'ticker', page: 1, pageSize: 10 },
    true,
  )
  const search = screen.getByTestId('location').textContent ?? ''
  expect(search).toContain('catalyst_age=48')
  expect(search).toContain('horizon_sessions=3')
  expect(search).toContain('squeeze_status=incomplete')
  expect(search).not.toContain('squeeze_page')
})

test('changing the sort also resets only the squeeze page', () => {
  listing(squeezeList())
  renderWithProviders(<ShortSqueezeSection />, ['/?squeeze_page=3&catalyst_page=2'])
  fireEvent.change(screen.getByLabelText('Short squeeze sort'), { target: { value: 'short_float' } })
  expect(useShortSqueezes).toHaveBeenLastCalledWith(
    { status: 'matched', sort: 'short_float', page: 1, pageSize: 10 },
    true,
  )
})

test('invalid URL values fall back to the defaults', () => {
  listing(squeezeList())
  renderWithProviders(<ShortSqueezeSection />, [
    '/?squeeze_status=excluded&squeeze_sort=score&squeeze_page=-2',
  ])
  expect(useShortSqueezes).toHaveBeenLastCalledWith(
    { status: 'matched', sort: 'move', page: 1, pageSize: 10 },
    true,
  )
})

test('pagination moves the squeeze page alone', () => {
  listing(squeezeList({ total: 25 }))
  renderWithProviders(
    <>
      <ShortSqueezeSection />
      <LocationProbe />
    </>,
    ['/?catalyst_page=4'],
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next short squeeze page' }))
  const search = screen.getByTestId('location').textContent ?? ''
  expect(search).toContain('squeeze_page=2')
  expect(search).toContain('catalyst_page=4')
})

test('mounting reads cached results only and never posts', async () => {
  const actual = await vi.importActual<typeof import('./short-squeeze-hooks')>('./short-squeeze-hooks')
  vi.mocked(useShortSqueezes).mockImplementation(actual.useShortSqueezes)
  vi.mocked(useShortSqueezeDetail).mockImplementation(actual.useShortSqueezeDetail)
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(squeezeList() as never)
  const post = vi.spyOn(apiClient, 'post')

  renderWithProviders(<ShortSqueezeSection />)

  await waitFor(() => expect(screen.getByRole('button', { name: 'Inspect SQZ' })).toBeInTheDocument())
  expect(get).toHaveBeenCalledWith(
    '/v1/discover/short-squeezes?status=matched&sort=move&page=1&page_size=10',
  )
  expect(get).toHaveBeenCalledTimes(1)
  expect(post).not.toHaveBeenCalled()
})
