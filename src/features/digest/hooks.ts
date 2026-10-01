import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  dismissDigestItem,
  getIntradayDigest,
  getMorningDigest,
  getTickerDigest,
  sendMorningDigest,
} from '@/api/digest'
import { runJob } from '@/api/system'

export type DigestView = 'morning' | 'intraday'

export function digestQueryKey(edition: DigestView, date?: string) {
  return ['digest', edition, date ?? 'today'] as const
}

/** One edition per cache entry, so an intraday rebuild can never overwrite
 * the morning edition already on screen. */
export function useDigest(edition: DigestView, date?: string) {
  return useQuery({
    queryKey: digestQueryKey(edition, date),
    queryFn: () => (edition === 'morning' ? getMorningDigest(date) : getIntradayDigest(date)),
  })
}

/** Compatibility wrapper for callers that only ever show the morning. */
export function useMorningDigest() {
  return useDigest('morning')
}

export function useTickerDigest(ticker: string) {
  return useQuery({
    queryKey: ['digest', 'ticker', ticker],
    queryFn: () => getTickerDigest(ticker),
    enabled: Boolean(ticker),
  })
}

/** A manual build is an intraday update; the morning edition stays as captured. */
export function useBuildDigest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => runJob('digest_build'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['digest', 'intraday'] }),
  })
}

export function useDismissDigestItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => dismissDigestItem(ticker),
    // Dismissal filters both editions at read time.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['digest', 'morning'] }),
        queryClient.invalidateQueries({ queryKey: ['digest', 'intraday'] }),
      ]),
  })
}

export function useSendMorningDigest() {
  return useMutation({
    mutationFn: () => sendMorningDigest(),
  })
}
