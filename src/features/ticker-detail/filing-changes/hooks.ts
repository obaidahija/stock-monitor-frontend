import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  compareAnnualFilings,
  explainFilingChanges,
  getFilingChangePage,
  getFilingChanges,
} from '@/api/filing-changes'
import type {
  FilingChangeFilters,
  FilingComparisonOut,
} from '@/types/filing-changes'

export const filingChangesKey = (ticker: string) => ['filing-changes', ticker] as const
export const filingChangePageKey = (
  ticker: string,
  comparisonId: number | undefined,
  filters: FilingChangeFilters,
) => ['filing-change-page', ticker, comparisonId, filters] as const

/**
 * Cache-only read of the saved comparison. Mounting the panel does exactly
 * this and nothing else -- no SEC request, no generation, no spend.
 */
export function useFilingChanges(ticker: string) {
  return useQuery({
    queryKey: filingChangesKey(ticker),
    queryFn: () => getFilingChanges(ticker),
  })
}

export function useFilingChangePage(
  ticker: string,
  comparisonId: number | undefined,
  filters: FilingChangeFilters,
) {
  return useQuery({
    queryKey: filingChangePageKey(ticker, comparisonId, filters),
    queryFn: () => getFilingChangePage(ticker, comparisonId as number, filters),
    // Without a comparison there is no page to read, and firing the request
    // anyway would 404 on every fresh ticker.
    enabled: comparisonId !== undefined,
  })
}

export function useCompareAnnualFilings(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => compareAnnualFilings(ticker),
    // A comparison is expensive and explicitly user-initiated; silently
    // retrying it would double the SEC work behind one click.
    retry: false,
    onSuccess: async (result) => {
      // A failed refresh returns the previous cached comparison alongside
      // source.ok=false. Only write to the cache when a comparison came back,
      // so a failure never blanks a result the reader still has -- and the
      // failure itself stays visible in the mutation's own state.
      if (result.comparison) {
        await queryClient.cancelQueries({ queryKey: filingChangesKey(ticker), exact: true })
        queryClient.setQueryData<FilingComparisonOut | null>(
          filingChangesKey(ticker),
          result.comparison,
        )
        queryClient.invalidateQueries({
          queryKey: ['filing-change-page', ticker],
        })
      }
    },
  })
}

export function useExplainFilingChanges(ticker: string, comparisonId: number | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => explainFilingChanges(ticker, comparisonId as number),
    retry: false,
    onSuccess: async (result) => {
      await queryClient.cancelQueries({ queryKey: filingChangesKey(ticker), exact: true })
      queryClient.setQueryData<FilingComparisonOut | null>(
        filingChangesKey(ticker),
        (current) => current && current.id !== result.comparison.id
          ? current
          : result.comparison,
      )
      // Annotations attach to findings, so only this comparison's pages are
      // stale. The comparison itself was not recomputed.
      queryClient.invalidateQueries({
        queryKey: ['filing-change-page', ticker, result.comparison.id],
      })
    },
  })
}
