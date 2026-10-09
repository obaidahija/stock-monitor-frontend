import { ApiError, apiClient, apiFetch } from '@/lib/api-client'
import type { TwitterOperationOut } from '@/types/api'
import type {
  CompanyAccountConfirm,
  CompanyAccountOut,
  CompanyAccountSave,
  CompanyPostsPageOut,
  CompanyPostsSort,
  CompanyPostsView,
} from '@/types/twitter-company'

/**
 * Company X accounts for one ticker. GET wrappers only read local state; only
 * validate, ensure and refresh can queue work on the server, and every write sends
 * the mapping revision the caller is looking at.
 */
function companyPath(ticker: string, suffix = '') {
  return `/v1/twitter/company-accounts/${encodeURIComponent(ticker.trim().toUpperCase())}${suffix}`
}

export function getCompanyAccount(ticker: string) {
  return apiClient.get<CompanyAccountOut>(companyPath(ticker))
}

export function saveCompanyAccount(ticker: string, body: CompanyAccountSave) {
  return apiClient.put<CompanyAccountOut>(companyPath(ticker), body)
}

export function confirmCompanyAccount(ticker: string, body: CompanyAccountConfirm) {
  return apiClient.post<CompanyAccountOut>(companyPath(ticker, '/confirm'), body)
}

/**
 * apiClient.delete takes no body, but removal must carry the expected revision, so
 * this one call uses apiFetch with the same error parsing as every other request.
 */
export async function removeCompanyAccount(ticker: string, expectedRevision: number) {
  const response = await apiFetch(companyPath(ticker), {
    method: 'DELETE',
    body: JSON.stringify({ expected_revision: expectedRevision }),
  })
  if (!response.ok) {
    let detail: unknown = null
    try {
      const body = await response.json()
      detail = body?.detail ?? body
    } catch {
      // no JSON body
    }
    throw new ApiError(response.status, detail)
  }
  return (await response.json()) as CompanyAccountOut
}

/** Metadata-only profile lookup; never confirms the account or collects posts. */
export function validateCompanyAccount(ticker: string, expectedRevision: number) {
  return apiClient.post<TwitterOperationOut>(companyPath(ticker, '/validate'), {
    expected_revision: expectedRevision,
  })
}

/** Cached posts only — never starts collection, whatever the cache state. */
export function getCompanyPosts(ticker: string, page = 1, sort: CompanyPostsSort = 'newest', view: CompanyPostsView = 'all') {
  return apiClient.get<CompanyPostsPageOut>(companyPath(ticker, `/posts?page=${page}&sort=${sort}&view=${view}`))
}

export function retryCompanyAnalysis(ticker: string, expectedRevision: number) {
  return apiClient.post<CompanyPostsPageOut>(companyPath(ticker, '/posts/analysis/retry'), { expected_revision: expectedRevision })
}

/** 200 with the cache when no work is needed, 202 with the queued lookup or fetch. */
export function ensureCompanyPosts(ticker: string, expectedRevision: number) {
  return apiClient.post<CompanyPostsPageOut>(companyPath(ticker, '/posts/ensure'), {
    expected_revision: expectedRevision,
  })
}

/** Like ensure, but skips the one-hour freshness check (still deduplicated). */
export function refreshCompanyPosts(ticker: string, expectedRevision: number) {
  return apiClient.post<CompanyPostsPageOut>(companyPath(ticker, '/posts/refresh'), {
    expected_revision: expectedRevision,
  })
}
