import { useQuery } from '@tanstack/react-query'
import { getResearchCapabilities } from '@/api/research-capabilities'
import { getSetupWindowPreview } from '@/api/watchlists'
import { ApiError } from '@/lib/api-client'

/** Which short-term research features the backend has switched on. */
export function useResearchCapabilities() {
  return useQuery({
    queryKey: ['research-capabilities'],
    queryFn: getResearchCapabilities,
    staleTime: 5 * 60_000,
  })
}

function retryUnlessDisabled(failureCount: number, error: Error) {
  // A 503 means the feature is off: retrying cannot change the answer.
  if (error instanceof ApiError && error.status === 503) return false
  return failureCount < 1
}

/**
 * The exact window a swing setup saved now would get. The browser never
 * counts exchange sessions itself -- the server resolves holidays, early
 * closes and DST -- so the preview refreshes while a form stays open.
 */
export function useSetupWindowPreview(horizonSessions: number, enabled: boolean) {
  return useQuery({
    queryKey: ['setup-window', horizonSessions],
    queryFn: () => getSetupWindowPreview(horizonSessions),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: retryUnlessDisabled,
  })
}
