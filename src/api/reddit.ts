import { apiClient } from '@/lib/api-client'
import type {
  RedditAuthRecheckOut,
  RedditAuthStateOut,
  RedditCommentSort,
  RedditFeedFilter,
  RedditFeedRefreshOut,
  RedditListingSort,
  RedditOperationOut,
  RedditPageOut,
  RedditSearchResultOut,
  RedditSort,
  RedditThreadOut,
  RedditTimeFilter,
  RedditTopMentionsOut,
  RedditTopMentionsRefreshOut,
  RedditTrustedAuthorOut,
  RedditTrustedSubredditOut,
} from '@/types/api'

export type RedditPostType = 'news' | 'recommendation' | 'analysis' | 'other' | 'general'

export interface RedditFeedParams {
  filter?: RedditFeedFilter
  sort?: RedditSort
  page?: number
  postTypes?: RedditPostType[]
  tickers?: string[]
  subreddits?: string[]
}

export function getRedditAuth() {
  return apiClient.get<RedditAuthStateOut>('/v1/reddit/auth')
}

export function recheckRedditAuth() {
  return apiClient.post<RedditAuthRecheckOut>('/v1/reddit/auth/recheck')
}

export function getRedditOperation(operationId: string) {
  return apiClient.get<RedditOperationOut>(
    `/v1/reddit/operations/${encodeURIComponent(operationId)}`,
  )
}

export function searchRedditTicker(ticker: string, force = false) {
  return apiClient.post<RedditSearchResultOut>('/v1/reddit/searches', { ticker, force })
}

export function getRedditSearch(ticker: string, sort: RedditSort = 'signal') {
  return apiClient.get<RedditSearchResultOut>(
    `/v1/reddit/searches/${encodeURIComponent(ticker)}?sort=${sort}`,
  )
}

export function getRedditFeed(params: RedditFeedParams = {}) {
  const query = new URLSearchParams()
  if (params.filter) query.set('filter', params.filter)
  if (params.sort) query.set('sort', params.sort)
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.postTypes && params.postTypes.length > 0)
    query.set('post_types', params.postTypes.join(','))
  if (params.tickers && params.tickers.length > 0) query.set('tickers', params.tickers.join(','))
  if (params.subreddits && params.subreddits.length > 0)
    query.set('subreddits', params.subreddits.join(','))
  return apiClient.get<RedditPageOut>(`/v1/reddit/feed?${query.toString()}`)
}

export function refreshRedditFeed() {
  return apiClient.post<RedditFeedRefreshOut>('/v1/reddit/feed/refresh')
}

export function getRedditTopMentions(limit = 20) {
  return apiClient.get<RedditTopMentionsOut>(`/v1/reddit/top-mentions?limit=${limit}`)
}

export function refreshRedditTopMentions() {
  return apiClient.post<RedditTopMentionsRefreshOut>('/v1/reddit/top-mentions/refresh')
}

export function getTrustedSubreddits() {
  return apiClient.get<RedditTrustedSubredditOut[]>('/v1/reddit/trusted-subreddits')
}

export function addTrustedSubreddit(name: string, defaultSort: RedditListingSort = 'new') {
  return apiClient.post<RedditTrustedSubredditOut>('/v1/reddit/trusted-subreddits', {
    name,
    default_sort: defaultSort,
  })
}

export function deleteTrustedSubreddit(name: string) {
  return apiClient.delete<void>(
    `/v1/reddit/trusted-subreddits/${encodeURIComponent(name)}`,
  )
}

export function fetchTrustedSubreddit(
  name: string,
  sort: RedditListingSort = 'new',
  timeFilter?: RedditTimeFilter,
) {
  return apiClient.post<RedditOperationOut>(
    `/v1/reddit/trusted-subreddits/${encodeURIComponent(name)}/fetch`,
    { sort, time_filter: timeFilter ?? null, force: true },
  )
}

export function getTrustedRedditAuthors() {
  return apiClient.get<RedditTrustedAuthorOut[]>('/v1/reddit/trusted-authors')
}

export function addTrustedRedditAuthor(username: string) {
  return apiClient.post<RedditTrustedAuthorOut>('/v1/reddit/trusted-authors', { username })
}

export function deleteTrustedRedditAuthor(username: string) {
  return apiClient.delete<void>(
    `/v1/reddit/trusted-authors/${encodeURIComponent(username)}`,
  )
}

export function fetchTrustedRedditAuthor(username: string) {
  return apiClient.post<RedditOperationOut>(
    `/v1/reddit/trusted-authors/${encodeURIComponent(username)}/fetch`,
    { force: true },
  )
}

export function getTrustedSubredditPosts(
  name: string,
  sort: RedditListingSort = 'new',
  timeFilter?: RedditTimeFilter,
) {
  const query = new URLSearchParams({ sort })
  if (timeFilter) query.set('time_filter', timeFilter)
  return apiClient.get<RedditSearchResultOut>(
    `/v1/reddit/subreddits/${encodeURIComponent(name)}/posts?${query.toString()}`,
  )
}

export function getRedditPost(postId: string) {
  return apiClient.get<RedditThreadOut>(
    `/v1/reddit/posts/${encodeURIComponent(postId)}`,
  )
}

export function refreshRedditThread(
  postId: string,
  commentSort: RedditCommentSort = 'best',
) {
  return apiClient.post<RedditThreadOut>(
    `/v1/reddit/posts/${encodeURIComponent(postId)}/refresh`,
    { comment_sort: commentSort, force: true },
  )
}
