import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addWatchlistItem,
  cloneSetup,
  createAiSetups,
  createManualSetup,
  createWatchlist,
  deleteWatchlist,
  getSetupHistory,
  getTickerMemberships,
  getWatchlistItems,
  getWatchlists,
  removeWatchlistItem,
  renameWatchlist,
  updateWatchlistSetup,
  type AiSetupInput,
  type ManualSetupInput,
  type SetupTimingInput,
  type SetupUpdateInput,
} from '@/api/watchlists'

function invalidateWatchlists(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['watchlists'] })
}

export function useWatchlists(ticker?: string) {
  return useQuery({
    queryKey: ['watchlists', ticker ?? null],
    queryFn: () => getWatchlists(ticker),
  })
}

export function useWatchlistItems(id: number | null) {
  return useQuery({
    queryKey: ['watchlists', 'items', id],
    queryFn: () => getWatchlistItems(id!),
    enabled: id !== null,
    refetchInterval: 60_000,
  })
}

export function useTickerMemberships(ticker: string, enabled = true) {
  return useQuery({
    queryKey: ['watchlists', 'memberships', ticker],
    queryFn: () => getTickerMemberships(ticker),
    enabled,
  })
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createWatchlist(name),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useRenameWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameWatchlist(id, name),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useDeleteWatchlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteWatchlist(id),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useAddWatchlistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ watchlistId, ticker }: { watchlistId: number; ticker: string }) =>
      addWatchlistItem(watchlistId, ticker),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useRemoveWatchlistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ watchlistId, ticker }: { watchlistId: number; ticker: string }) =>
      removeWatchlistItem(watchlistId, ticker),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useCreateManualSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ManualSetupInput) => createManualSetup(body),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useCreateAiSetups() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AiSetupInput) => createAiSetups(body),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useUpdateWatchlistSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SetupUpdateInput }) =>
      updateWatchlistSetup(id, body),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useSetupHistory(itemId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['watchlists', 'history', itemId],
    queryFn: () => getSetupHistory(itemId!),
    enabled: enabled && itemId !== null,
  })
}

export function useCloneSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SetupTimingInput & { replace_existing?: boolean } }) =>
      cloneSetup(id, body),
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

