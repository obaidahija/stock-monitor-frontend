import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { askGoogleFinanceResearch, getInsider, getScoreHistory } from './stocks'

beforeEach(() => vi.restoreAllMocks())

test('requests score history with an explicit day window', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue([] as never)
  await getScoreHistory('nvda', 30)
  expect(get).toHaveBeenCalledWith('/v1/stocks/NVDA/score-history?days=30')
})

test('defaults the score history window to 90 days', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue([] as never)
  await getScoreHistory('NVDA')
  expect(get).toHaveBeenCalledWith('/v1/stocks/NVDA/score-history?days=90')
})

test('requests insider data with an explicit day window', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getInsider('abnb', 30)
  expect(get).toHaveBeenCalledWith('/v1/stocks/ABNB/insider?days=30')
})

test('defaults the insider window to 90 days', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getInsider('ABNB')
  expect(get).toHaveBeenCalledWith('/v1/stocks/ABNB/insider?days=90')
})

test('submits a ticker-scoped Google Finance question with no history by default', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)

  await askGoogleFinanceResearch('mstr', 'Why today?')

  expect(post).toHaveBeenCalledWith('/v1/stocks/MSTR/google-finance-research', {
    question: 'Why today?',
    history: [],
  })
})

test('submits a Google Finance follow-up question with prior turns as history', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  const history = [{ question: 'Why today?', answer: 'MSTR moved with Bitcoin.' }]

  await askGoogleFinanceResearch('mstr', 'What about its competitor?', history)

  expect(post).toHaveBeenCalledWith('/v1/stocks/MSTR/google-finance-research', {
    question: 'What about its competitor?',
    history,
  })
})
