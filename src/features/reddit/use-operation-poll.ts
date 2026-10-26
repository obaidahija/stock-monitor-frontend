import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRedditOperation } from '@/api/reddit'
import { ApiError } from '@/lib/api-client'
import type { RedditOperationOut } from '@/types/api'

export const ACTIVE_OPERATION_STATUSES = new Set(['queued', 'running', 'deferred'])

const isMissing = (error: unknown) => error instanceof ApiError && error.status === 404

/**
 * Polls one durable Reddit operation every 2 seconds until it reaches a terminal
 * status, or until the backend permanently reports it missing (404). `onTerminal`
 * fires once per operation: with the terminal operation, or with `null` when the
 * operation no longer exists.
 */
export function useRedditOperationPoll(
  operationId: string | null,
  onTerminal?: (operation: RedditOperationOut | null, operationId: string) => void,
) {
  const query = useQuery({
    queryKey: ['reddit', 'operation', operationId],
    queryFn: () => getRedditOperation(operationId as string),
    enabled: operationId != null,
    retry: (failures, error) => !isMissing(error) && failures < 1,
    refetchInterval: (state) => {
      if (isMissing(state.state.error)) return false
      const data = state.state.data
      return data && !ACTIVE_OPERATION_STATUSES.has(data.status) ? false : 2_000
    },
  })
  const fired = useRef<string | null>(null)
  const missing = isMissing(query.error)
  const terminal = query.data && !ACTIVE_OPERATION_STATUSES.has(query.data.status) ? query.data : null
  useEffect(() => {
    if (operationId == null || fired.current === operationId) return
    if (terminal?.id === operationId) {
      fired.current = operationId
      onTerminal?.(terminal, operationId)
    } else if (missing) {
      fired.current = operationId
      onTerminal?.(null, operationId)
    }
  }, [operationId, terminal, missing, onTerminal])
  return query
}
