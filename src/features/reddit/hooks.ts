import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/reddit'
import type {
  RedditFeedFilter,
  RedditListingSort,
  RedditSort,
  RedditTimeFilter,
} from '@/types/api'

export const redditKeys = {
  root: ['reddit'] as const,
  auth: ['reddit', 'auth'] as const,
  feed: (params: api.RedditFeedParams) => ['reddit', 'feed', params] as const,
  search: (ticker: string, sort: RedditSort) => ['reddit', 'search', ticker, sort] as const,
  subreddits: ['reddit', 'sources', 'subreddits'] as const,
  authors: ['reddit', 'sources', 'authors'] as const,
  thread: (postId: string) => ['reddit', 'thread', postId] as const,
  topMentions: (limit: number) => ['reddit', 'top-mentions', limit] as const,
}

export const useRedditAuth = () =>
  useQuery({ queryKey: redditKeys.auth, queryFn: api.getRedditAuth, refetchInterval: 30_000 })

export function useRecheckRedditAuth() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: api.recheckRedditAuth,
    onSuccess: (data) => client.setQueryData(redditKeys.auth, data.auth),
  })
}

export const useTrustedSubreddits = () =>
  useQuery({ queryKey: redditKeys.subreddits, queryFn: api.getTrustedSubreddits })
export const useTrustedAuthors = () =>
  useQuery({ queryKey: redditKeys.authors, queryFn: api.getTrustedRedditAuthors })

export function useSubredditMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: redditKeys.subreddits })
  return {
    add: useMutation({
      mutationFn: ({ name, sort }: { name: string; sort: RedditListingSort }) =>
        api.addTrustedSubreddit(name, sort),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.deleteTrustedSubreddit, onSuccess: invalidate }),
    fetch: useMutation({
      mutationFn: ({ name, sort, time }: { name: string; sort: RedditListingSort; time?: RedditTimeFilter }) =>
        api.fetchTrustedSubreddit(name, sort, time),
    }),
  }
}

export function useAuthorMutations() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: redditKeys.authors })
  return {
    add: useMutation({ mutationFn: api.addTrustedRedditAuthor, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: api.deleteTrustedRedditAuthor, onSuccess: invalidate }),
    fetch: useMutation({ mutationFn: api.fetchTrustedRedditAuthor }),
  }
}

export function useRedditFeed(params: {
  filter: RedditFeedFilter
  sort: RedditSort
  subreddit?: string
  page: number
  postTypes?: api.RedditPostType[]
}) {
  return useQuery({
    queryKey: redditKeys.feed(params),
    queryFn: () => api.getRedditFeed(params),
    refetchInterval: (query) =>
      query.state.data?.sentiment_pending ? 30_000 : false,
  })
}

export function useRefreshRedditFeed() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: api.refreshRedditFeed,
    onSuccess: () => client.invalidateQueries({ queryKey: ['reddit', 'feed'] }),
  })
}

export function useRedditTopMentions(limit: number) {
  return useQuery({
    queryKey: redditKeys.topMentions(limit),
    queryFn: () => api.getRedditTopMentions(limit),
    refetchInterval: (query) => (query.state.data?.refresh_active ? 15_000 : 60_000),
  })
}

export function useRefreshRedditTopMentions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: api.refreshRedditTopMentions,
    onSuccess: () => client.invalidateQueries({ queryKey: ['reddit', 'top-mentions'] }),
  })
}

export function useRedditSearch(ticker: string, sort: RedditSort = 'signal') {
  return useQuery({
    queryKey: redditKeys.search(ticker, sort),
    queryFn: () => api.getRedditSearch(ticker, sort),
    enabled: ticker.length > 0,
    refetchInterval: (query) =>
      query.state.data?.sentiment_pending ? 30_000 : false,
  })
}

export function useSearchRedditTicker() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ ticker, force }: { ticker: string; force: boolean }) =>
      api.searchRedditTicker(ticker, force),
    onSuccess: (data, { ticker }) => client.setQueryData(redditKeys.search(ticker, 'signal'), data),
  })
}

export const useRedditThread = (postId: string | null) =>
  useQuery({
    queryKey: redditKeys.thread(postId ?? ''),
    queryFn: () => api.getRedditPost(postId as string),
    enabled: postId !== null,
  })

export function useRefreshRedditThread() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) => api.refreshRedditThread(postId),
    onSuccess: (data, { postId }) => client.setQueryData(redditKeys.thread(postId), data),
  })
}
