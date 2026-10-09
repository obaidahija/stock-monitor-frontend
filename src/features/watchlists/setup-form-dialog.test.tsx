import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import type { WatchlistSetupOut } from '@/types/api'
import { SetupFormDialog } from './setup-form-dialog'

const create = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }))
const update = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }))
const capabilities = vi.hoisted(() => ({ swing: true }))
const toastError = vi.hoisted(() => vi.fn())

vi.mock('./hooks', () => ({
  useCreateManualSetup: () => create,
  useUpdateWatchlistSetup: () => update,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }))

vi.mock('@/features/research/hooks', () => ({
  useResearchCapabilities: () => ({
    data: {
      swing_research_enabled: capabilities.swing,
      research_outcomes_v2_enabled: false,
      catalyst_scanner_enabled: false,
      follow_through_enabled: false,
      event_window_v2_enabled: false,
      research_intraday_enabled: false,
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSetupWindowPreview: (horizonSessions: number, enabled: boolean) => ({
    data: enabled
      ? {
          window: {
            starts_at: '2026-09-21T12:00:00Z',
            anchor_session: '2026-09-21',
            horizon_sessions: horizonSessions,
            expires_at: '2026-09-25T20:00:00Z',
            expires_on: '2026-09-25',
            calendar: 'XNYS',
            window_version: 'swing-window-v1',
          },
          server_time: '2026-09-21T12:00:00Z',
        }
      : undefined,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

afterEach(() => {
  cleanup()
  create.mutateAsync.mockReset()
  update.mutateAsync.mockReset()
  toastError.mockReset()
  capabilities.swing = true
})

const swingSetup: WatchlistSetupOut = {
  id: 20,
  watchlist_item_id: 10,
  ticker: 'NVDA',
  side: 'long',
  horizon: 'swing',
  horizon_sessions: 3,
  window: {
    starts_at: '2026-09-21T12:00:00Z',
    anchor_session: '2026-09-21',
    horizon_sessions: 3,
    expires_at: '2026-09-23T20:00:00Z',
    expires_on: '2026-09-23',
    calendar: 'XNYS',
    window_version: 'swing-window-v1',
  },
  expires_on: '2026-09-23',
  source_mode: 'manual',
  status: 'active',
  is_current: true,
  entry_primary: 100,
  entry_secondary: null,
  stop_loss: 90,
  take_profit: 120,
  note: null,
  research_snapshot_id: null,
  levels_snapshot_id: null,
  needs_review: false,
  sync_error: null,
  research: null,
  created_at: '2026-09-21T12:00:00Z',
  updated_at: '2026-09-21T12:00:00Z',
  superseded_at: null,
}

async function fillLevels(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Primary entry'), '100')
  await user.type(screen.getByLabelText('Stop loss'), '90')
  await user.type(screen.getByLabelText('Take profit'), '120')
}

test('creates a swing setup with five sessions by default and no caller expiry', async () => {
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /create setup/i }))
  await user.selectOptions(screen.getByLabelText('Horizon'), 'swing')

  expect((screen.getByLabelText('Research window') as HTMLSelectElement).value).toBe('5')
  expect(screen.getByText('Expires Fri, Sep 25, 4:00 PM ET')).toBeTruthy()
  expect(screen.queryByLabelText('Expires on')).toBeNull()

  await fillLevels(user)
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(create.mutateAsync).toHaveBeenCalledWith({
    watchlist_id: 1,
    ticker: 'NVDA',
    side: 'long',
    horizon: 'swing',
    horizon_sessions: 5,
    expires_on: undefined,
    entry_primary: 100,
    entry_secondary: undefined,
    stop_loss: 90,
    take_profit: 120,
    note: undefined,
  })
})

test('a legacy create never sends a session count', async () => {
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /create setup/i }))
  await fillLevels(user)
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  const body = create.mutateAsync.mock.calls[0][0]
  expect(body.horizon).toBe('short_term')
  expect('horizon_sessions' in body).toBe(false)
})

test('editing only the session count sends it alone', async () => {
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" setup={swingSetup} />)
  await user.click(screen.getByRole('button', { name: /edit setup/i }))

  expect((screen.getByLabelText('Horizon') as HTMLSelectElement).value).toBe('swing')
  expect((screen.getByLabelText('Research window') as HTMLSelectElement).value).toBe('3')

  await user.selectOptions(screen.getByLabelText('Research window'), '7')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(update.mutateAsync).toHaveBeenCalledWith({ id: 20, body: { horizon_sessions: 7 } })
})

test('a note-only edit keeps the saved window', async () => {
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" setup={swingSetup} />)
  await user.click(screen.getByRole('button', { name: /edit setup/i }))
  // The saved window is shown, not a fresh preview.
  expect(screen.getByText('Expires Wed, Sep 23, 4:00 PM ET')).toBeTruthy()
  await user.type(screen.getByLabelText('Note'), 'watch volume')
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(update.mutateAsync).toHaveBeenCalledWith({ id: 20, body: { note: 'watch volume' } })
})

test('a saved swing setup stays selected and editable when the capability is off', async () => {
  capabilities.swing = false
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" setup={swingSetup} />)
  await user.click(screen.getByRole('button', { name: /edit setup/i }))

  expect((screen.getByLabelText('Horizon') as HTMLSelectElement).value).toBe('swing')
  expect(screen.getByLabelText('Research window')).toBeDisabled()
})

test('a new setup cannot pick swing while the capability is off', async () => {
  capabilities.swing = false
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /create setup/i }))
  expect(screen.queryByRole('option', { name: /swing/i })).toBeNull()
})

test('a disabled-feature response is reported once, not retried', async () => {
  create.mutateAsync.mockRejectedValueOnce(
    new ApiError(503, { code: 'swing_research_disabled', message: 'disabled' }),
  )
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /create setup/i }))
  await user.selectOptions(screen.getByLabelText('Horizon'), 'swing')
  await fillLevels(user)
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(create.mutateAsync).toHaveBeenCalledTimes(1)
  expect(toastError).toHaveBeenCalledWith('Swing research windows are turned off')
})

test('an ordinary create never sends a strategy origin or a replacement', async () => {
  const user = userEvent.setup()
  render(<SetupFormDialog watchlistId={1} ticker="NVDA" />)
  await user.click(screen.getByRole('button', { name: /create setup/i }))
  await fillLevels(user)
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  const body = create.mutateAsync.mock.calls[0][0]
  expect('strategy_observation_id' in body).toBe(false)
  expect('replace_existing' in body).toBe(false)
  expect(screen.queryByRole('button', { name: /use 8% target/i })).toBeNull()
})

test('a controlled form opens from initial values and still needs a stop and a target', async () => {
  const onOpenChange = vi.fn()
  render(
    <SetupFormDialog
      watchlistId={1}
      ticker="SQZ"
      open
      onOpenChange={onOpenChange}
      initialValues={{
        identity: 'scanner:7:1',
        side: 'long',
        horizon: 'swing',
        horizonSessions: 5,
        entryPrimary: 10.8,
        referenceLabel: 'Signal close $10.80 on Oct 5, 2026',
        proposedTargetPct: 8,
        strategyObservationId: 7,
        enforceLevelOrder: true,
      }}
    />,
  )
  expect(screen.queryByRole('button', { name: /create setup/i })).toBeNull()
  expect(screen.getByLabelText('Primary entry')).toHaveValue(10.8)
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})
