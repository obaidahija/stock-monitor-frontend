import { expect, test } from 'vitest'
import { pageSlice } from './paging'

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

test('returns the requested page with 1-based bounds', () => {
  expect(pageSlice(range(1, 25), 2, 10)).toEqual({
    items: range(11, 20),
    page: 2,
    totalPages: 3,
    total: 25,
    start: 11,
    end: 20,
  })
})

test('clamps a page past the end to the last page', () => {
  expect(pageSlice(range(1, 25), 9, 10)).toMatchObject({ page: 3, start: 21, end: 25 })
})

test('an empty list is one empty page', () => {
  expect(pageSlice([], 1, 10)).toEqual({ items: [], page: 1, totalPages: 1, total: 0, start: 0, end: 0 })
})
