import { apiClient } from '@/lib/api-client'
import type {
  TwitterAuthRecheckOut,
  TwitterAuthStateOut,
  TwitterFeedRefreshOut,
  TwitterOperationOut,
  TwitterPageOut,
  TwitterSearchResultOut,
  TwitterTrustedAccountCreateOut,
  TwitterTrustedAccountOut,
} from '@/types/api'

export type TwitterSort = 'signal' | 'newest' | 'virality'
export type TwitterFeedFilter = 'all' | 'trusted' | 'viral'
export type TwitterMinimumViews = 1000 | 2000 | 3000 | 5000
export type TweetType = 'news' | 'recommendation' | 'analysis' | 'other' | 'general'

export function getTwitterAuth() {
  return apiClient.get<TwitterAuthStateOut>('/v1/twitter/auth')
}

export function recheckTwitterAuth() {
  return apiClient.post<TwitterAuthRecheckOut>('/v1/twitter/auth/recheck')
}

export function getTwitterOperation(operationId: string) {
  return apiClient.get<TwitterOperationOut>(
    `/v1/twitter/operations/${encodeURIComponent(operationId)}`,
  )
}

export function getTrustedAccounts() {
  return apiClient.get<TwitterTrustedAccountOut[]>('/v1/twitter/trusted-accounts')
}

export function addTrustedAccount(username: string) {
  return apiClient.post<TwitterTrustedAccountCreateOut>('/v1/twitter/trusted-accounts', {
    username,
  })
}

export function removeTrustedAccount(username: string) {
  return apiClient.delete<void>(`/v1/twitter/trusted-accounts/${encodeURIComponent(username)}`)
}

export function updateTrustedAccountSweepLimit(username: string, sweepPostLimit: number) {
  return apiClient.patch<TwitterTrustedAccountOut>(
    `/v1/twitter/trusted-accounts/${encodeURIComponent(username)}`,
    { sweep_post_limit: sweepPostLimit },
  )
}

export function fetchTrustedAccount(username: string, limit = 20) {
  return apiClient.post<TwitterOperationOut>(
    `/v1/twitter/trusted-accounts/${encodeURIComponent(username)}/fetch`,
    { limit },
  )
}

export function searchTicker(
  ticker: string,
  sort: TwitterSort = 'signal',
  minViews: TwitterMinimumViews = 2000,
) {
  return apiClient.post<TwitterSearchResultOut>(
    `/v1/twitter/searches?sort=${sort}`,
    { ticker, min_views: minViews },
  )
}

// Cache-only read — never enqueues a live twitter-cli call, unlike searchTicker above.
export function getTickerSearchCache(ticker: string, sort: TwitterSort = 'signal') {
  return apiClient.get<TwitterSearchResultOut>(
    `/v1/twitter/searches/${encodeURIComponent(ticker)}?sort=${sort}`,
  )
}

export interface TwitterFeedParams {
  filter?: TwitterFeedFilter
  sort?: TwitterSort
  page?: number
  tickers?: string[]
  usernames?: string[]
  tweetTypes?: TweetType[]
}

export function getTwitterFeed(params: TwitterFeedParams = {}) {
  const qs = new URLSearchParams()
  if (params.filter) qs.set('filter', params.filter)
  if (params.sort) qs.set('sort', params.sort)
  if (params.page !== undefined) qs.set('page', String(params.page))
  if (params.tickers && params.tickers.length > 0) qs.set('tickers', params.tickers.join(','))
  if (params.usernames && params.usernames.length > 0) qs.set('usernames', params.usernames.join(','))
  if (params.tweetTypes && params.tweetTypes.length > 0)
    qs.set('tweet_types', params.tweetTypes.join(','))
  return apiClient.get<TwitterPageOut>(`/v1/twitter/feed?${qs.toString()}`)
}

export function refreshTwitterFeed() {
  return apiClient.post<TwitterFeedRefreshOut>('/v1/twitter/feed/refresh')
}
