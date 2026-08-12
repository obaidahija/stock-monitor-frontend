import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTwitterOperation } from '@/api/twitter'
import type { TwitterOperationOut } from '@/types/api'

const TERMINAL_STATUSES = new Set(['succeeded', 'failed'])

/**
 * Polls a durable Twitter operation every 2s until it reaches a terminal
 * status, then stops. Foreground user actions (add account, recheck auth,
 * refresh a search) deserve a tighter interval than the ambient 30s polling
 * used for health/jobs — someone is watching a spinner here.
 */
export function useTwitterOperationPoll(
  operationId: string | null | undefined,
  onTerminal?: (operation: TwitterOperationOut) => void,
) {
  const query = useQuery({
    queryKey: ['twitter', 'operation', operationId],
    queryFn: () => getTwitterOperation(operationId as string),
    enabled: operationId != null,
    refetchInterval: (q) => (q.state.data && TERMINAL_STATUSES.has(q.state.data.status) ? false : 2_000),
  })

  const firedForId = useRef<string | null>(null)
  useEffect(() => {
    const data = query.data
    if (!data || !TERMINAL_STATUSES.has(data.status)) return
    if (firedForId.current === data.id) return
    firedForId.current = data.id
    onTerminal?.(data)
  }, [query.data, onTerminal])

  return query
}
