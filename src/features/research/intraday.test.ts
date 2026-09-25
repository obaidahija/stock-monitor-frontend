import { expect, test } from 'vitest'
import { intradayErrorMessage, sameTimeVolumeLabel } from './intraday'
import { ApiError } from '@/lib/api-client'

const base = {
  session: '2026-09-23',
  lag_minutes: 0,
  minimum_sessions: 10,
  interval: '5m',
}

test('a ratio names its cutoff and sample instead of standing alone', () => {
  expect(
    sameTimeVolumeLabel({
      ...base,
      value: 2,
      status: 'ok',
      reason: null,
      cutoff_at: '2026-09-23T14:30:00Z',
      sample_sessions: 20,
    }),
  ).toBe('2.00x same-time volume through 10:30 AM ET · 20 prior sessions (5-minute bars)')
})

test('fewer than ten comparable sessions is unavailable, not zero', () => {
  expect(
    sameTimeVolumeLabel({
      ...base,
      value: null,
      status: 'unavailable',
      reason: 'insufficient_baseline_sessions',
      cutoff_at: '2026-09-23T14:30:00Z',
      sample_sessions: 8,
    }),
  ).toBe('Same-time volume unavailable: 8 of 10 comparable sessions')
})

test('a stale cutoff is labelled stale', () => {
  expect(
    sameTimeVolumeLabel({
      ...base,
      value: null,
      status: 'stale',
      reason: 'stale_cutoff',
      cutoff_at: null,
      lag_minutes: 15,
      sample_sessions: 0,
    }),
  ).toBe('Same-time volume stale: 5-minute bars 15 min behind')
})

test('other gaps read as their reason', () => {
  expect(
    sameTimeVolumeLabel({
      ...base,
      value: null,
      status: 'unavailable',
      reason: 'incomplete_current_prefix',
      cutoff_at: null,
      sample_sessions: 0,
    }),
  ).toBe('Same-time volume unavailable: incomplete current prefix')
})

test('capacity and disabled errors are explained', () => {
  expect(
    intradayErrorMessage(new ApiError(409, { code: 'intraday_symbol_capacity' })),
  ).toBe('Intraday collection is at its 100-symbol limit')
  expect(intradayErrorMessage(new ApiError(503, { code: 'research_intraday_disabled' }))).toBe(
    'Intraday collection is switched off',
  )
  expect(intradayErrorMessage(new Error('boom'))).toBe('Could not change intraday collection')
})
