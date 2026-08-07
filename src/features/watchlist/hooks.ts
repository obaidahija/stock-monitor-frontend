import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addToWatchlist, listWatchlist, removeFromWatchlist } from '@/api/watchlist'

export function useWatchlist() {
  return useQuery({ queryKey: ['watchlist'], queryFn: listWatchlist })
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticker, note }: { ticker: string; note?: string }) =>
      addToWatchlist(ticker, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => removeFromWatchlist(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })
}
