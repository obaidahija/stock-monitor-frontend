import { expect, test } from 'vitest'
import type { DigestItem } from '@/types/api'
import { filterDigestItems, paginateDigestItems } from './browsing'

const items = [
  { ticker: 'AAPL', stages: ['earnings'], reasons: ['Revenue beat expectations'], headline_snippets: ['Apple raises guidance'], new_today: true },
  { ticker: 'NVDA', stages: ['earnings', 'premarket_gap'], reasons: ['Shares moved'], headline_snippets: [], new_today: false },
  { ticker: 'OLD', stages: ['filing'], reasons: ['Agreement filed'], headline_snippets: [], new_today: null },
] as DigestItem[]

test('search matches saved ticker and evidence text without changing ranking', () => {
  expect(filterDigestItems(items, { query: '  apple ', stages: [], newOnly: false }).map((item) => item.ticker)).toEqual(['AAPL'])
  expect(filterDigestItems(items, { query: 'NVDA', stages: [], newOnly: false }).map((item) => item.ticker)).toEqual(['NVDA'])
  expect(filterDigestItems(items, { query: 'agreement', stages: [], newOnly: false }).map((item) => item.ticker)).toEqual(['OLD'])
})

test('new-only requires recorded novelty and combines with the stage filter', () => {
  expect(filterDigestItems(items, { query: '', stages: ['earnings'], newOnly: true }).map((item) => item.ticker)).toEqual(['AAPL'])
  expect(filterDigestItems(items, { query: '', stages: ['filing'], newOnly: true })).toEqual([])
})

test('news-volume filtering includes saved sections without a matching stage and preserves ranking', () => {
  const saved = [
    { ...items[0], ticker: 'FIRST', section: 'news_volume', stages: ['score_leader'] },
    { ...items[1], ticker: 'SECOND', section: 'news_volume', stages: [] },
    { ...items[2], ticker: 'OTHER', section: 'filing', stages: ['filing'] },
  ] as DigestItem[]
  expect(filterDigestItems(saved, { query: '', stages: ['news_volume'], newOnly: false })
    .map((item) => item.ticker)).toEqual(['FIRST', 'SECOND'])
  expect(filterDigestItems(saved, { query: '', stages: ['news_volume', 'filing'], newOnly: false })
    .map((item) => item.ticker)).toEqual(['FIRST', 'SECOND', 'OTHER'])
  expect(saved[1].stages).toEqual([])
})

test('pagination covers every ticker once with bounded pages and clamps invalid pages', () => {
  const many = Array.from({ length: 55 }, (_, index) => ({ ...items[0], ticker: `T${index}` }))
  const first = paginateDigestItems(many, 1)
  const second = paginateDigestItems(many, 2)
  const last = paginateDigestItems(many, 999)

  expect(first.items).toHaveLength(24)
  expect(second.items[0].ticker).toBe('T24')
  expect(last.items.map((item) => item.ticker)).toEqual(['T48', 'T49', 'T50', 'T51', 'T52', 'T53', 'T54'])
  expect(last).toMatchObject({ page: 3, pageCount: 3, start: 49, end: 55, total: 55 })
  expect(new Set([...first.items, ...second.items, ...last.items].map((item) => item.ticker)).size).toBe(55)
  expect(paginateDigestItems(many, -1).page).toBe(1)
  expect(paginateDigestItems(many, Number.NaN).page).toBe(1)
  expect(paginateDigestItems([], 99)).toMatchObject({ items: [], page: 1, pageCount: 1, start: 0, end: 0, total: 0 })
})
