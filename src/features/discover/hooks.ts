import { useQuery } from '@tanstack/react-query'
import { getGappers, getNotableFilings, getUnusualVolume } from '@/api/discover'

export function useGappers(minGapPct: number) {
  return useQuery({ queryKey: ['discover', 'gappers', minGapPct], queryFn: () => getGappers(minGapPct) })
}

export function useUnusualVolume(minRatio: number) {
  return useQuery({
    queryKey: ['discover', 'unusual-volume', minRatio],
    queryFn: () => getUnusualVolume(minRatio),
  })
}

export function useNotableFilings() {
  return useQuery({ queryKey: ['discover', 'filings'], queryFn: getNotableFilings })
}
