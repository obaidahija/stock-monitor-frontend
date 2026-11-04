import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  dismissDigestItem,
  getIntradayDigest,
  getMorningDigest,
  getTickerDigest,
  getDigestDismissals,
  restoreDigestItem,
  sendMorningDigest,
} from '@/api/digest'
import { runJob } from '@/api/system'
import { useMarketDate } from './use-market-date'

export type DigestView = 'morning' | 'intraday'

export function digestQueryKey(edition: DigestView, date?: string) {
  return ['digest', edition, date ?? 'today'] as const
}

/** One edition per cache entry, so an intraday rebuild can never overwrite
 * the morning edition already on screen. */
export function useDigest(edition: DigestView, date?: string) {
  const today = useMarketDate()
  const selectedDate = date ?? today
  return useQuery({
    queryKey: digestQueryKey(edition, selectedDate),
    queryFn: () => (edition === 'morning' ? getMorningDigest(selectedDate) : getIntradayDigest(selectedDate)),
    refetchInterval: selectedDate === today ? 60_000 : false,
    refetchIntervalInBackground: false,
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
    mutationFn: async () => {
      const result = await runJob('digest_build')
      if (result.status !== 'success') {
        const reason = result.error ?? result.detail?.reason
        throw new Error(typeof reason === 'string' ? reason : 'The digest could not be built. Please try again.')
      }
      return result
    },
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
        queryClient.invalidateQueries({ queryKey: ['digest-dismissals'] }),
      ]),
  })
}

export function useDigestDismissals(enabled: boolean) {
  return useQuery({ queryKey: ['digest-dismissals'], queryFn: getDigestDismissals, enabled, staleTime: 0 })
}

export function useRestoreDigestItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: restoreDigestItem,
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['digest', 'morning'] }),
      queryClient.invalidateQueries({ queryKey: ['digest', 'intraday'] }),
      queryClient.invalidateQueries({ queryKey: ['digest-dismissals'] }),
    ]),
  })
}

export function useSendMorningDigest() {
  return useMutation({
    mutationFn: (date?: string) => sendMorningDigest(date),
  })
}
