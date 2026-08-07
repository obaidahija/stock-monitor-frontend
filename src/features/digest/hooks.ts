import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMorningDigest, getTickerDigest } from '@/api/digest'
import { runJob } from '@/api/system'

export function useMorningDigest() {
  return useQuery({
    queryKey: ['digest', 'morning'],
    queryFn: () => getMorningDigest(),
  })
}

export function useTickerDigest(ticker: string) {
  return useQuery({
    queryKey: ['digest', 'ticker', ticker],
    queryFn: () => getTickerDigest(ticker),
    enabled: Boolean(ticker),
  })
}

export function useBuildDigest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => runJob('digest_build'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['digest', 'morning'] }),
  })
}
