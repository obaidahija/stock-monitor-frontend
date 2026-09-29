import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activateFollowThrough,
  getFollowThrough,
  listFollowThrough,
  stopFollowThrough,
} from '@/api/follow-through'
import type { FollowThroughCreate } from '@/types/api'

export function useFollowThroughTracks(ticker: string, enabled: boolean, page = 1) {
  return useQuery({
    queryKey: ['follow-through', 'ticker', ticker, page],
    queryFn: () => listFollowThrough(ticker, page),
    enabled,
    staleTime: 30_000,
  })
}

export function useFollowThroughDetail(id: number | null) {
  return useQuery({
    queryKey: ['follow-through', 'detail', id],
    queryFn: () => getFollowThrough(id!),
    enabled: id !== null,
    refetchInterval: id === null ? false : 60_000,
  })
}

export function useActivateFollowThrough() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ body, key }: { body: FollowThroughCreate; key: string }) =>
      activateFollowThrough(body, key),
    onSuccess: (track) => {
      void client.invalidateQueries({ queryKey: ['follow-through', 'ticker', track.ticker] })
      void client.invalidateQueries({ queryKey: ['follow-through', 'detail', track.id] })
    },
  })
}

export function useStopFollowThrough() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: stopFollowThrough,
    onSuccess: (track) => {
      void client.invalidateQueries({ queryKey: ['follow-through', 'ticker', track.ticker] })
      void client.invalidateQueries({ queryKey: ['follow-through', 'detail', track.id] })
    },
  })
}
