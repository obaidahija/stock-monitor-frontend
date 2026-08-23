import { beforeEach, expect, test, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import {
  addTrustedRedditAuthor,
  addTrustedSubreddit,
  deleteTrustedRedditAuthor,
  deleteTrustedSubreddit,
  getRedditFeed,
  getRedditPost,
  getRedditSearch,
  getTrustedSubredditPosts,
  refreshRedditThread,
  searchRedditTicker,
} from './reddit'

beforeEach(() => vi.restoreAllMocks())

test('builds encoded Reddit feed filters', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  await getRedditFeed({
    filter: 'trusted',
    sort: 'comments',
    subreddits: ['wallstreetbets'],
    page: 2,
  })
  expect(get).toHaveBeenCalledWith(
    '/v1/reddit/feed?filter=trusted&sort=comments&page=2&subreddits=wallstreetbets',
  )
})

test('posts manual ticker search and thread refresh', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  await searchRedditTicker('NVDA', true)
  await refreshRedditThread('abc123', 'best')
  expect(post).toHaveBeenNthCalledWith(1, '/v1/reddit/searches', {
    ticker: 'NVDA',
    force: true,
  })
  expect(post).toHaveBeenNthCalledWith(2, '/v1/reddit/posts/abc123/refresh', {
    comment_sort: 'best',
    force: true,
  })
})

test('encodes every Reddit path parameter', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({} as never)
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({} as never)
  const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({} as never)
  await getRedditSearch('BRK.B')
  await getRedditPost('abc_123')
  await getTrustedSubredditPosts('value investing', 'top', 'week')
  await addTrustedSubreddit('value investing', 'top')
  await deleteTrustedSubreddit('value investing')
  await addTrustedRedditAuthor('Some User')
  await deleteTrustedRedditAuthor('Some User')
  expect(get).toHaveBeenNthCalledWith(1, '/v1/reddit/searches/BRK.B?sort=signal')
  expect(get).toHaveBeenNthCalledWith(2, '/v1/reddit/posts/abc_123')
  expect(get).toHaveBeenNthCalledWith(
    3,
    '/v1/reddit/subreddits/value%20investing/posts?sort=top&time_filter=week',
  )
  expect(post).toHaveBeenNthCalledWith(1, '/v1/reddit/trusted-subreddits', {
    name: 'value investing',
    default_sort: 'top',
  })
  expect(remove).toHaveBeenNthCalledWith(
    1,
    '/v1/reddit/trusted-subreddits/value%20investing',
  )
  expect(post).toHaveBeenNthCalledWith(2, '/v1/reddit/trusted-authors', {
    username: 'Some User',
  })
  expect(remove).toHaveBeenNthCalledWith(
    2,
    '/v1/reddit/trusted-authors/Some%20User',
  )
})
