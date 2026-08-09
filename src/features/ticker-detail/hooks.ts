import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAnalysis,
  getCatalysts,
  getEarnings,
  getFilings,
  getNews,
  getSentimentHistory,
  getSocial,
  getUniverseScore,
  refreshEarnings,
  refreshNews,
} from '@/api/stocks'
import type { SentimentBucketGranularity } from '@/types/api'

export function useAnalysis(ticker: string) {
  return useQuery({ queryKey: ['analysis', ticker], queryFn: () => getAnalysis(ticker) })
}

export function useUniverseScore(ticker: string) {
  return useQuery({
    queryKey: ['universe-score', ticker],
    queryFn: () => getUniverseScore(ticker),
  })
}

export function useSocial(ticker: string) {
  return useQuery({ queryKey: ['social', ticker], queryFn: () => getSocial(ticker) })
}

export function useSentimentHistory(
  ticker: string,
  bucket: SentimentBucketGranularity,
  periods: number,
) {
  return useQuery({
    queryKey: ['sentiment-history', ticker, bucket, periods],
    queryFn: () => getSentimentHistory(ticker, bucket, periods),
  })
}

export function useEarnings(ticker: string) {
  return useQuery({ queryKey: ['earnings', ticker], queryFn: () => getEarnings(ticker) })
}

export function useRefreshEarnings(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshEarnings(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['earnings', ticker] }),
  })
}

export function useNews(ticker: string, hours: number) {
  return useQuery({ queryKey: ['news', ticker, hours], queryFn: () => getNews(ticker, hours) })
}

export function useRefreshNews(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshNews(ticker),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['news', ticker] }),
  })
}

export function useFilings(ticker: string) {
  return useQuery({ queryKey: ['filings', ticker], queryFn: () => getFilings(ticker) })
}

export function useCatalysts(ticker: string) {
  return useQuery({ queryKey: ['catalysts', ticker], queryFn: () => getCatalysts(ticker) })
}
