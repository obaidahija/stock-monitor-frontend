import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  type TwitterFeedParams,
  type TwitterSort,
} from '@/api/twitter'

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
    mutationFn: ({ ticker, sort }: { ticker: string; sort: TwitterSort }) => searchTicker(ticker, sort),
    onSuccess: (data, { ticker, sort }) => {
      queryClient.setQueryData(['twitter', 'search', ticker, sort], data)
    },
  })
}
