import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getEarningsReports, refreshEarningsReports } from '@/api/stocks'

export function useEarningsReports(ticker: string) {
  return useQuery({
    queryKey: ['earnings-reports', ticker],
    queryFn: () => getEarningsReports(ticker),
    refetchInterval: (query) => query.state.data?.reports.some(
      (report) => report.analysis.status === 'pending' || report.analysis.status === 'processing',
    ) ? 2000 : 60_000,
  })
}

export function useRefreshEarningsReports(ticker: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => refreshEarningsReports(ticker),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['earnings-reports', ticker] })
      client.invalidateQueries({ queryKey: ['filings', ticker] })
    },
  })
}
