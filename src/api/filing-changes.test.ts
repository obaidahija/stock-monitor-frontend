import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import {
  compareAnnualFilings,
  explainFilingChanges,
  getFilingChangePage,
  getFilingChanges,
} from './filing-changes'
import { DEFAULT_FILING_CHANGE_FILTERS } from '@/types/filing-changes'

beforeEach(() => vi.restoreAllMocks())

test('reads the saved comparison from a cache-only endpoint', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)
  await getFilingChanges('nvda')
  expect(get).toHaveBeenCalledWith('/v1/stocks/NVDA/filing-changes')
})

test('posts the compare action with no body', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  await compareAnnualFilings('nvda')
  expect(post).toHaveBeenCalledWith('/v1/stocks/NVDA/filing-changes/compare')
})

test('posts the explain action for one comparison', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  await explainFilingChanges('abnb', 42)
  expect(post).toHaveBeenCalledWith('/v1/stocks/ABNB/filing-changes/42/explain')
})

test('requests a change page with default filters', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getFilingChangePage('NVDA', 7, DEFAULT_FILING_CHANGE_FILTERS)
  expect(get).toHaveBeenCalledWith(
    '/v1/stocks/NVDA/filing-changes/7/changes?offset=0&limit=25',
  )
})

test('encodes every active filter', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getFilingChangePage('nvda', 7, {
    section: 'mda',
    kind: 'modified',
    topic: 'liquidity',
    include_routine: true,
    offset: 25,
    limit: 50,
  })
  expect(get).toHaveBeenCalledWith(
    '/v1/stocks/NVDA/filing-changes/7/changes' +
      '?section=mda&kind=modified&topic=liquidity&include_routine=true&offset=25&limit=50',
  )
})

test('omits include_routine when routine updates stay hidden', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getFilingChangePage('NVDA', 1, { ...DEFAULT_FILING_CHANGE_FILTERS, kind: 'added' })
  expect(get).toHaveBeenCalledWith(
    '/v1/stocks/NVDA/filing-changes/1/changes?kind=added&offset=0&limit=25',
  )
})

test('escapes a ticker that is not URL safe', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue(null as never)
  await getFilingChanges('brk/b')
  expect(get).toHaveBeenCalledWith('/v1/stocks/BRK%2FB/filing-changes')
})
