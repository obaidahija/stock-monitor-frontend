import { expect, test } from 'vitest'
import type { EarningsEventOut, YfEarningsEventOut } from '@/types/api'
import { chooseTrackRecord } from './earnings-track-record'

function finnhub(eventDate: string, estimate: number, actual: number): EarningsEventOut {
  return {
    id: Number(eventDate.replaceAll('-', '')),
    ticker: 'NVDA',
    event_date: eventDate,
    bmo_amc: 'amc',
    eps_estimate: estimate,
    eps_actual: actual,
    revenue_estimate: null,
    revenue_actual: null,
  } as EarningsEventOut
}

function yahoo(eventDate: string, estimate: number | null, actual: number | null): YfEarningsEventOut {
  return { event_date: eventDate, bmo_amc: 'amc', eps_estimate: estimate, eps_actual: actual }
}

test('uses the Yahoo series when it covers more quarters', () => {
  const quarters = Array.from({ length: 14 }, (_, i) =>
    yahoo(`20${23 + Math.floor(i / 4)}-${String(((i % 4) * 3) + 2).padStart(2, '0')}-20`, 1, 1.1),
  )
  const record = chooseTrackRecord([finnhub('2026-08-26', 2.1384, 2.22)], quarters)

  expect(record).toMatchObject({ source: 'yahoo', beats: 12, beatRatePct: 100, streak: 12 })
  // The same window the EPS chart draws: the latest 12.
  expect(record?.quarters).toHaveLength(12)
  expect(record?.quarters[0].eventDate).toBe(quarters[13].event_date)
})

test('keeps Finnhub when it has at least as many quarters', () => {
  const record = chooseTrackRecord(
    [finnhub('2026-08-26', 2, 2.2), finnhub('2026-05-28', 2, 1.8)],
    [yahoo('2026-08-26', 2, 2.2)],
  )

  expect(record).toMatchObject({ source: 'finnhub', beats: 1, beatRatePct: 50, streak: 1 })
  expect(record?.quarters.map((q) => q.eventDate)).toEqual(['2026-08-26', '2026-05-28'])
})

test('ignores quarters without an actual and returns null when nothing is classified', () => {
  expect(chooseTrackRecord([], [yahoo('2026-11-17', 2.5, null)])).toBeNull()
})

test('excludes releases whose EPS comparison is pending', () => {
  const event = { ...finnhub('2026-08-26', 2, 2.2), eps_comparison_available: false }
  expect(chooseTrackRecord([event], [])).toBeNull()
})

test('uses the stored Yahoo comparison when summarizing a release', () => {
  const event = {
    ...finnhub('2026-08-26', 2, 2.2),
    eps_comparison_available: true,
    eps_comparison_basis: 'provider_reported',
    eps_comparison_actual: 1.8,
    eps_comparison_estimate: 2,
  }
  expect(chooseTrackRecord([event], [])).toMatchObject({ beats: 0, beatRatePct: 0 })
})
