import { useQuery } from '@tanstack/react-query'
import { getAnalysis, getCatalysts, getEarnings, getFilings, getNews } from '@/api/stocks'

export function useAnalysis(ticker: string) {
  return useQuery({ queryKey: ['analysis', ticker], queryFn: () => getAnalysis(ticker) })
}

export function useEarnings(ticker: string) {
  return useQuery({ queryKey: ['earnings', ticker], queryFn: () => getEarnings(ticker) })
}

export function useNews(ticker: string, hours: number) {
  return useQuery({ queryKey: ['news', ticker, hours], queryFn: () => getNews(ticker, hours) })
}

export function useFilings(ticker: string) {
  return useQuery({ queryKey: ['filings', ticker], queryFn: () => getFilings(ticker) })
}

export function useCatalysts(ticker: string) {
  return useQuery({ queryKey: ['catalysts', ticker], queryFn: () => getCatalysts(ticker) })
}
