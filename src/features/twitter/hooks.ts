import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addTrustedAccount,
  fetchTrustedAccount,
  getTickerSearchCache,
  getTrustedAccounts,
  getTwitterAuth,
  getTwitterFeed,
  recheckTwitterAuth,
  refreshTwitterFeed,
  removeTrustedAccount,
  searchTicker,
  updateTrustedAccountSweepLimit,
  type TwitterFeedParams,
  type TwitterMinimumViews,
  type TwitterSort,
} from '@/api/twitter'
import type { TwitterOperationOut } from '@/types/api'

const TWITTER_SEARCH_REQUEST_KEY = ['twitter', 'search-request'] as const

export const twitterSearchOperationKey = (ticker: string) =>
  ['twitter', 'search-operation', ticker] as const

/** Client-only state survives a tab unmount and passive search-cache reads. */
export function useTwitterSearchOperation(ticker: string) {
  const operation = useQuery<TwitterOperationOut | null>({
    queryKey: twitterSearchOperationKey(ticker),
    queryFn: () => null,
    initialData: null,
    enabled: false,
    gcTime: Infinity,
  })
  const pendingRequests = useIsMutating({
    mutationKey: TWITTER_SEARCH_REQUEST_KEY,
    predicate: (mutation) =>
      (mutation.state.variables as { ticker?: string } | undefined)?.ticker === ticker,
  })
  return { data: operation.data, isRequestPending: pendingRequests > 0 }
}

export function useTwitterAuth() {
  return useQuery({ queryKey: ['twitter', 'auth'], queryFn: getTwitterAuth, refetchInterval: 30_000 })
}

export function useRecheckAuth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recheckTwitterAuth,
    onSuccess: (data) => {
      // The response already carries the latest known state (often still
      // "checking") — reflect it immediately rather than waiting for the
      // next 30s poll or the operation to finish.
      queryClient.setQueryData(['twitter', 'auth'], data.auth)
    },
  })
}

export function useTrustedAccounts() {
  return useQuery({ queryKey: ['twitter', 'trusted-accounts'], queryFn: getTrustedAccounts })
}

export function useAddTrustedAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (username: string) => addTrustedAccount(username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['twitter', 'trusted-accounts'] }),
  })
}

export function useRemoveTrustedAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (username: string) => removeTrustedAccount(username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['twitter', 'trusted-accounts'] }),
  })
}

export function useFetchTrustedAccount() {
  return useMutation({
    mutationFn: ({ username, limit }: { username: string; limit?: number }) =>
      fetchTrustedAccount(username, limit),
  })
}

export function useUpdateTrustedAccountSweepLimit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ username, sweepPostLimit }: { username: string; sweepPostLimit: number }) =>
      updateTrustedAccountSweepLimit(username, sweepPostLimit),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['twitter', 'trusted-accounts'] }),
  })
}

export function useTwitterFeed(params: TwitterFeedParams, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: ['twitter', 'feed', params],
    queryFn: () => getTwitterFeed(params),
    refetchInterval,
  })
}

export function useRefreshFeed() {
  return useMutation({ mutationFn: refreshTwitterFeed })
}

// Passive, cache-only load — shows whatever's already been fetched for this
// ticker without ever triggering a live twitter-cli call itself.
export function useTwitterSearchCache(ticker: string, sort: TwitterSort) {
  return useQuery({
    queryKey: ['twitter', 'search', ticker, sort],
    queryFn: () => getTickerSearchCache(ticker, sort),
    enabled: ticker.length > 0,
  })
}

// Explicit refresh — only called from a user-initiated "Refresh" click.
export function useSearchTicker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: TWITTER_SEARCH_REQUEST_KEY,
    mutationFn: ({
      ticker,
      sort,
      minViews,
    }: {
      ticker: string
      sort: TwitterSort
      minViews: TwitterMinimumViews
    }) => searchTicker(ticker, sort, minViews),
    onSuccess: (data, { ticker, sort }) => {
      queryClient.setQueryData(twitterSearchOperationKey(ticker), data.operation)
      queryClient.setQueryData(['twitter', 'search', ticker, sort], data)
    },
  })
}
