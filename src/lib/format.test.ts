import { expect, test } from 'vitest'
import {
  easternDaysUntil,
  formatBucketDay,
  formatCompactNumber,
  formatEasternDate,
  formatEasternDateTime,
  formatEasternDateTimeWithYear,
  formatEasternHour,
  formatEasternTime,
  formatMoneyAmount,
  formatOrdinal,
  formatSurprisePct,
  formatTimestamp,
} from './format'

test('formats ordinary ordinals', () => {
  expect(formatOrdinal(1)).toBe('1st')
  expect(formatOrdinal(2)).toBe('2nd')
  expect(formatOrdinal(3)).toBe('3rd')
  expect(formatOrdinal(4)).toBe('4th')
  expect(formatOrdinal(82)).toBe('82nd')
})

test('formats the teens, which do not follow the last-digit rule', () => {
  expect(formatOrdinal(11)).toBe('11th')
  expect(formatOrdinal(12)).toBe('12th')
  expect(formatOrdinal(13)).toBe('13th')
})

test('rounds a fractional percentile to a whole ordinal', () => {
  expect(formatOrdinal(82.4)).toBe('82nd')
})

test('formats an instant in New York time with an ET label', () => {
  expect(formatEasternDateTime('2026-10-07T17:27:00Z')).toBe('Oct 7, 1:27 PM ET')
  // Winter: New York is UTC-5.
  expect(formatEasternDateTime('2026-12-01T17:00:00Z')).toBe('Dec 1, 12:00 PM ET')
  expect(formatEasternDateTime(null)).toBe('—')
})

test('formats the New York date, time and hour of an instant', () => {
  // 02:30 UTC on Oct 8 is still Oct 7 in New York.
  expect(formatEasternDate('2026-10-08T02:30:00Z')).toBe('Oct 7, 2026')
  expect(formatEasternTime('2026-10-07T17:27:00Z')).toBe('1:27 PM ET')
  expect(formatEasternHour('2026-10-07T13:00:00Z')).toBe('9 AM ET')
  expect(formatEasternTime(undefined)).toBe('—')
})

test('shows a midnight-UTC filing timestamp as its date only', () => {
  expect(formatTimestamp('2026-09-23T00:00:00Z')).toBe('Sep 23, 2026')
  expect(formatTimestamp('2026-09-23T00:00:00+00:00')).toBe('Sep 23, 2026')
  expect(formatTimestamp('2026-10-07T16:20:20Z')).toBe('Oct 7, 12:20 PM ET')
  expect(formatTimestamp(null)).toBe('—')
})

test('labels a day bucket with its UTC calendar date', () => {
  expect(formatBucketDay('2026-09-08T00:00:00Z')).toBe('Sep 8')
})

test('counts calendar days to a date in New York', () => {
  // UTC is already Sunday, but New York is still Saturday until 04:00 UTC.
  expect(easternDaysUntil('2026-09-24', new Date('2026-09-20T02:00:00Z'))).toBe(5)
  expect(easternDaysUntil('2026-09-19', new Date('2026-09-20T02:00:00Z'))).toBe(0)
  // Crossing the spring DST change still counts calendar days.
  expect(easternDaysUntil('2026-03-10', new Date('2026-03-08T04:30:00Z'))).toBe(3)
})

test('shortens large counts and keeps small ones whole', () => {
  expect(formatCompactNumber(1_082_683)).toBe('1.08M')
  expect(formatCompactNumber(280_964_657)).toBe('281M')
  expect(formatCompactNumber(23_132_626_000)).toBe('23.1B')
  expect(formatCompactNumber(100_000)).toBe('100K')
  expect(formatCompactNumber(82_145)).toBe('82,145')
  expect(formatCompactNumber(null)).toBe('—')
})

test('puts the sign before the dollar sign', () => {
  expect(formatMoneyAmount(-967_599_313)).toBe('-$968M')
  expect(formatMoneyAmount(250_000, { signed: true })).toBe('+$250K')
  expect(formatMoneyAmount(2_773_638)).toBe('$2.77M')
  expect(formatMoneyAmount(82_145.6)).toBe('$82,146')
  expect(formatMoneyAmount(0, { signed: true })).toBe('$0')
  expect(formatMoneyAmount(undefined)).toBe('—')
})

test('drops decimals from very large earnings surprises', () => {
  expect(formatSurprisePct(3.84)).toBe('+3.8%')
  expect(formatSurprisePct(-2.5)).toBe('-2.5%')
  expect(formatSurprisePct(1218.4)).toBe('+1,218%')
  expect(formatSurprisePct(0)).toBe('0.0%')
  expect(formatSurprisePct(null)).toBe('—')
})

test('formats a saved timestamp in New York time with its year', () => {
  expect(formatEasternDateTimeWithYear('2026-10-07T17:27:00Z')).toBe('Oct 7, 2026, 1:27 PM ET')
  expect(formatEasternDateTimeWithYear(null)).toBe('—')
})
