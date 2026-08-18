import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addWatchlistItem,
  cloneSetup,
  createWatchlistEvent,
  createAiSetups,
  createManualSetup,
  createWatchlist,
  deleteWatchlist,
  deleteWatchlistEvent,
  getSetupHistory,
  getTelegramStatus,
  getTickerMemberships,
  getWatchlistItems,
  getWatchlistEvents,
  getWatchlists,
  removeWatchlistItem,
  rearmWatchlistEvent,
  renameWatchlist,
  retryWatchlistEventDelivery,
  sendTelegramTest,
  updateWatchlistSetup,
  updateWatchlistEvent,
  type AiSetupInput,
  type ManualSetupInput,
  type SetupTimingInput,
  type SetupUpdateInput,
  type WatchlistEventInput,
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
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
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

export function useWatchlistEvents(itemId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['watchlists', 'events', itemId],
    queryFn: () => getWatchlistEvents(itemId!),
    enabled: enabled && itemId !== null,
  })
}

function useEventMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateWatchlists(queryClient),
  })
}

export function useCreateWatchlistEvent() {
  return useEventMutation(
    ({ itemId, body }: { itemId: number; body: WatchlistEventInput }) =>
      createWatchlistEvent(itemId, body),
  )
}

export function useUpdateWatchlistEvent() {
  return useEventMutation(
    ({ id, body }: { id: number; body: WatchlistEventInput }) =>
      updateWatchlistEvent(id, body),
  )
}

export function useRearmWatchlistEvent() {
  return useEventMutation(
    ({ id, body }: { id: number; body: WatchlistEventInput }) =>
      rearmWatchlistEvent(id, body),
  )
}

export function useDeleteWatchlistEvent() {
  return useEventMutation((id: number) => deleteWatchlistEvent(id))
}

export function useRetryWatchlistEventDelivery() {
  return useEventMutation((id: number) => retryWatchlistEventDelivery(id))
}

export function useTelegramStatus(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'telegram', 'status'],
    queryFn: getTelegramStatus,
    enabled,
    retry: false,
  })
}

export function useSendTelegramTest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sendTelegramTest,
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ['notifications', 'telegram', 'status'],
    }),
  })
}
