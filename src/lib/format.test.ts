import { expect, test } from 'vitest'
import { formatOrdinal } from './format'

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
