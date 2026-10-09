import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  confirmCompanyAccount,
  getCompanyAccount,
  getCompanyPosts,
  removeCompanyAccount,
  saveCompanyAccount,
  validateCompanyAccount,
  retryCompanyAnalysis,
} from '@/api/twitter-company'
import { ApiError } from '@/lib/api-client'
import type {
  CompanyAccountConfirm,
  CompanyAccountOut,
  CompanyAccountSave,
  CompanyPostsSort,
  CompanyPostsView,
} from '@/types/twitter-company'

export const companyAccountKey = (ticker: string) => ['twitter', 'company-account', ticker] as const

export const companyPostsKey = (ticker: string, mappingRevision: number, page: number, sort: CompanyPostsSort = 'newest', view: CompanyPostsView = 'all') =>
  ['twitter', 'company-posts', ticker, mappingRevision, page, sort, view] as const

const companyPostsPrefix = (ticker: string) => ['twitter', 'company-posts', ticker] as const

/** Passive directory read: never collects, whatever triggers the (re)fetch. */
export function useCompanyAccount(ticker: string) {
  return useQuery({
    queryKey: companyAccountKey(ticker),
    queryFn: () => getCompanyAccount(ticker),
    enabled: ticker.length > 0,
  })
}

/**
 * Passive cache read for one page of a mapping revision. A page change keeps the same
 * mapping's previous page on screen while the next loads; a different ticker or
 * revision starts empty, so a replaced mapping never shows the former account's posts.
 */
export function useCompanyPosts(
  ticker: string,
  mappingRevision: number,
  page: number,
  { enabled = true, active = true, sort = 'newest', view = 'all' }: { enabled?: boolean; active?: boolean; sort?: CompanyPostsSort; view?: CompanyPostsView } = {},
) {
  return useQuery({
    queryKey: companyPostsKey(ticker, mappingRevision, page, sort, view),
    queryFn: () => getCompanyPosts(ticker, page, sort, view),
    enabled: enabled && ticker.length > 0,
    refetchInterval: (query) => active && (query.state.data?.analysis_pending_count ?? 0) > 0 ? 3000 : false,
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey
      return key?.[2] === ticker && key?.[3] === mappingRevision && key?.[5] === sort && key?.[6] === view ? previous : undefined
    },
  })
}

export function useRetryCompanyAnalysis(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (revision: number) => retryCompanyAnalysis(ticker, revision),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: companyPostsPrefix(ticker) }) },
    onError: (error) => reloadOnConflict(queryClient, ticker, error),
  })
}

function applyDirectory(queryClient: QueryClient, ticker: string, account: CompanyAccountOut) {
  queryClient.setQueryData(companyAccountKey(ticker), account)
  void queryClient.invalidateQueries({ queryKey: companyPostsPrefix(ticker) })
}

function reloadOnConflict(queryClient: QueryClient, ticker: string, error: unknown) {
  // A stale revision means someone else changed the mapping: show the current one
  // and let the user review it, rather than retrying blindly.
  if (error instanceof ApiError && error.status === 409) {
    void queryClient.invalidateQueries({ queryKey: companyAccountKey(ticker) })
    void queryClient.invalidateQueries({ queryKey: companyPostsPrefix(ticker) })
  }
}

export function useSaveCompanyAccount(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CompanyAccountSave) => saveCompanyAccount(ticker, body),
    onSuccess: (account) => applyDirectory(queryClient, ticker, account),
    onError: (error) => reloadOnConflict(queryClient, ticker, error),
  })
}

export function useConfirmCompanyAccount(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CompanyAccountConfirm) => confirmCompanyAccount(ticker, body),
    onSuccess: (account) => applyDirectory(queryClient, ticker, account),
    onError: (error) => reloadOnConflict(queryClient, ticker, error),
  })
}

export function useRemoveCompanyAccount(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (expectedRevision: number) => removeCompanyAccount(ticker, expectedRevision),
    onSuccess: (account) => applyDirectory(queryClient, ticker, account),
    onError: (error) => reloadOnConflict(queryClient, ticker, error),
  })
}

/** Metadata-only lookup of the saved selection; it can never confirm the mapping. */
export function useValidateCompanyAccount(ticker: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (expectedRevision: number) => validateCompanyAccount(ticker, expectedRevision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyAccountKey(ticker) })
    },
    onError: (error) => reloadOnConflict(queryClient, ticker, error),
  })
}
