import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { DigestPage } from './digest-page'
import type { DigestDeliveryOut, TelegramStatusOut } from '@/types/api'

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

vi.mock('@/features/digest/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/digest/hooks')>()),
  useMorningDigest: () => ({
    data: {
      digest_date: '2026-09-06',
      generated_at: '2026-09-06T11:45:00Z',
      payload: {
        items: [
          {
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
          },
        ],
      },
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useBuildDigest: () => ({ mutate: vi.fn(), isPending: false }),
  useSendMorningDigest: () => sendState,
}))

vi.mock('@/features/watchlists/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/watchlists/hooks')>()),
  useTelegramStatus: () => ({ data: telegram }),
}))

beforeEach(() => {
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
