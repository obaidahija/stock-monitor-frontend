import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { WatchlistOut } from '@/types/api'
import { squeezeDetail } from '@/features/discover/short-squeeze.test-helpers'
import { SaveShortSqueezeSetupDialog } from './save-short-squeeze-setup-dialog'

const createManualSetup = vi.hoisted(() => vi.fn())
const createWatchlist = vi.hoisted(() => vi.fn())
const lists = vi.hoisted(() => ({ rows: [] as WatchlistOut[] }))

vi.mock('./hooks', () => ({
  useWatchlists: () => ({ data: lists.rows, isPending: false }),
  useCreateManualSetup: () => ({ mutateAsync: createManualSetup, isPending: false }),
  useUpdateWatchlistSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateWatchlist: () => ({ mutateAsync: createWatchlist, isPending: false }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/features/research/hooks', () => ({
  useResearchCapabilities: () => ({
    data: { swing_research_enabled: true, short_squeeze_scanner_enabled: true },
    isPending: false,
  }),
  useSetupWindowPreview: (horizonSessions: number, enabled: boolean) => ({
    data: enabled
      ? {
          window: {
            starts_at: '2026-10-05T21:00:00Z',
            anchor_session: '2026-10-06',
            horizon_sessions: horizonSessions,
            expires_at: '2026-10-12T20:00:00Z',
            expires_on: '2026-10-12',
            calendar: 'XNYS',
            window_version: 'swing-window-v1',
          },
          server_time: '2026-10-05T21:00:00Z',
        }
      : undefined,
    isPending: false,
    error: null,
  }),
}))

function watchlist(overrides: Partial<WatchlistOut> = {}): WatchlistOut {
  return {
    id: 1,
    name: 'Main',
    item_count: 3,
    contains_ticker: false,
    membership_id: null,
    has_setup: false,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  createManualSetup.mockReset()
  createWatchlist.mockReset()
  lists.rows = [watchlist()]
})
lists.rows = [watchlist()]

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Save setup' }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

async function setValue(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  if (value) await user.type(input, value)
}

test('opens a long five-session swing form with the dated signal close as an editable entry', async () => {
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  expect((screen.queryByLabelText('Watchlist') as HTMLSelectElement | null)).toBeNull()

  await openForm(user)

  expect((screen.getByLabelText('Side') as HTMLSelectElement).value).toBe('long')
  expect((screen.getByLabelText('Horizon') as HTMLSelectElement).value).toBe('swing')
  expect((screen.getByLabelText('Research window') as HTMLSelectElement).value).toBe('5')
  expect(screen.getByLabelText('Primary entry')).toHaveValue(10.8)
  expect(screen.getByText(/Signal close \$10\.80 on Oct 5, 2026/)).toBeInTheDocument()
  expect(screen.getByLabelText('Stop loss')).toHaveValue(null)
  expect(screen.getByLabelText('Take profit')).toHaveValue(null)
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  // Opening the selector and the form writes nothing.
  expect(createManualSetup).not.toHaveBeenCalled()
})

test('the 8% target is proposed only on request, from the chosen entry', async () => {
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  await openForm(user)
  await setValue(user, 'Primary entry', '100')
  expect(screen.getByLabelText('Take profit')).toHaveValue(null)

  await user.click(screen.getByRole('button', { name: 'Use 8% target' }))
  // proposes eight percent only after the user's explicit action
  expect(screen.getByLabelText('Take profit')).toHaveValue(108) // chosen entry 100

  await setValue(user, 'Primary entry', '102')
  expect(screen.getByLabelText('Take profit')).toHaveValue(110.16)
})

test('preserves_user_edited_target_after_entry_change', async () => {
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  await openForm(user)
  await setValue(user, 'Primary entry', '100')
  await user.click(screen.getByRole('button', { name: 'Use 8% target' }))

  // user edits target to 115, then changes entry to 102
  await setValue(user, 'Take profit', '115')
  await setValue(user, 'Primary entry', '102')

  expect(screen.getByLabelText('Take profit')).toHaveValue(115)
})

test('saves the scanner origin with explicit long swing levels', async () => {
  createManualSetup.mockResolvedValue({})
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail({ observation_id: 7 })} />)
  await openForm(user)
  await setValue(user, 'Stop loss', '9.9')
  await user.click(screen.getByRole('button', { name: 'Use 8% target' }))
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(createManualSetup).toHaveBeenCalledTimes(1)
  expect(createManualSetup).toHaveBeenCalledWith(
    expect.objectContaining({
      watchlist_id: 1,
      ticker: 'SQZ',
      side: 'long',
      horizon: 'swing',
      horizon_sessions: 5,
      entry_primary: 10.8,
      stop_loss: 9.9,
      take_profit: 11.66,
      strategy_observation_id: 7,
    }),
  )
  expect(createManualSetup.mock.calls[0][0]).not.toHaveProperty('replace_existing')
})

test('levels in the wrong long order cannot be saved', async () => {
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  await openForm(user)
  await setValue(user, 'Stop loss', '11')
  await setValue(user, 'Take profit', '12')

  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  expect(screen.getByText(/stop < secondary ≤ primary < target/)).toBeInTheDocument()
})

test('a corrected source needs an explicit review before saving', async () => {
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail({ source_corrected: true })} />)
  await openForm(user)
  await setValue(user, 'Stop loss', '9.9')
  await setValue(user, 'Take profit', '12')
  const save = screen.getByRole('button', { name: /^save$/i })
  expect(save).toBeDisabled()

  await user.click(screen.getByLabelText(/I reviewed the corrected source data/))
  expect(save).toBeEnabled()
})

test('incomplete and unrecorded evaluations never offer a save', () => {
  const { rerender } = render(
    <SaveShortSqueezeSetupDialog detail={squeezeDetail({ status: 'incomplete', observation_id: null })} />,
  )
  expect(screen.queryByRole('button', { name: 'Save setup' })).not.toBeInTheDocument()
  rerender(<SaveShortSqueezeSetupDialog detail={squeezeDetail({ observation_id: null })} />)
  expect(screen.queryByRole('button', { name: 'Save setup' })).not.toBeInTheDocument()
})

test('resets_provenance_when_selected_evaluation_changes', async () => {
  createManualSetup.mockResolvedValue({})
  const user = userEvent.setup()
  const first = squeezeDetail({ evaluation_id: 1, observation_id: 7, ticker: 'SQZ', signal_close: 10.8 })
  const second = squeezeDetail({ evaluation_id: 2, observation_id: 8, ticker: 'NEW', signal_close: 20 })
  const { rerender } = render(<SaveShortSqueezeSetupDialog detail={first} />)
  await openForm(user)
  await setValue(user, 'Stop loss', '9.9')
  await setValue(user, 'Take profit', '12')

  rerender(<SaveShortSqueezeSetupDialog detail={second} />)

  // The old selection's levels never carry over to the new one.
  expect(screen.queryByLabelText('Stop loss')).toBeNull()
  await openForm(user)
  expect(screen.getByLabelText('Primary entry')).toHaveValue(20)
  expect(screen.getByLabelText('Stop loss')).toHaveValue(null)
  await setValue(user, 'Stop loss', '18')
  await setValue(user, 'Take profit', '24')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  const body = createManualSetup.mock.calls[0][0]
  expect(body.strategy_observation_id).toBe(8)
  expect(body.ticker).toBe('NEW')
  expect(createManualSetup.mock.calls.flat()).not.toContainEqual(
    expect.objectContaining({ strategy_observation_id: 7 }),
  )
})

test('closing and reopening starts again from the scanner values', async () => {
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  await openForm(user)
  await setValue(user, 'Primary entry', '11.5')
  await setValue(user, 'Stop loss', '9.9')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await openForm(user)
  expect(screen.getByLabelText('Primary entry')).toHaveValue(10.8)
  expect(screen.getByLabelText('Stop loss')).toHaveValue(null)
})

test('a failed save keeps the entered levels', async () => {
  createManualSetup.mockRejectedValue(new Error('conflict'))
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  await openForm(user)
  await setValue(user, 'Stop loss', '9.9')
  await setValue(user, 'Take profit', '12.5')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(screen.getByLabelText('Stop loss')).toHaveValue(9.9)
  expect(screen.getByLabelText('Take profit')).toHaveValue(12.5)
})

test('replacing a list setup needs explicit confirmation and sends replace_existing', async () => {
  lists.rows = [watchlist({ id: 4, name: 'Swing', has_setup: true, contains_ticker: true })]
  createManualSetup.mockResolvedValue({})
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  await user.click(screen.getByRole('button', { name: 'Save setup' }))
  const proceed = screen.getByRole('button', { name: 'Continue' })
  expect(proceed).toBeDisabled()

  await user.click(screen.getByLabelText('Replace the current SQZ setup in Swing'))
  await user.click(proceed)
  await setValue(user, 'Stop loss', '9.9')
  await setValue(user, 'Take profit', '12')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(createManualSetup).toHaveBeenCalledWith(
    expect.objectContaining({ watchlist_id: 4, replace_existing: true, strategy_observation_id: 7 }),
  )
})

test('with no watchlist the user creates one explicitly', async () => {
  lists.rows = []
  const user = userEvent.setup()
  render(<SaveShortSqueezeSetupDialog detail={squeezeDetail()} />)
  await user.click(screen.getByRole('button', { name: 'Save setup' }))

  expect(createWatchlist).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await user.type(screen.getByLabelText('New watchlist name'), 'Squeezes')
  await user.click(screen.getByRole('button', { name: 'Create watchlist' }))
  expect(createWatchlist).toHaveBeenCalledWith('Squeezes')
})

test('a refetched watchlist list does not reset typed levels', async () => {
  const detail = squeezeDetail()
  const user = userEvent.setup()
  const { rerender } = render(<SaveShortSqueezeSetupDialog detail={detail} />)
  await openForm(user)
  await setValue(user, 'Stop loss', '9.9')

  lists.rows = [watchlist()] // same lists, fresh objects, as after a refetch
  rerender(<SaveShortSqueezeSetupDialog detail={detail} />)

  expect(screen.getByLabelText('Stop loss')).toHaveValue(9.9)
})
