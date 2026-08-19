import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRedditOperation } from '@/api/reddit'
import type { RedditOperationOut } from '@/types/api'

const ACTIVE = new Set(['queued', 'running', 'deferred'])

export function useRedditOperationPoll(
  operationId: string | null | undefined,
  onTerminal?: (operation: RedditOperationOut) => void,
) {
  const query = useQuery({
    queryKey: ['reddit', 'operation', operationId],
    queryFn: () => getRedditOperation(operationId as string),
    enabled: operationId != null,
    refetchInterval: (state) => (state.state.data && !ACTIVE.has(state.state.data.status) ? false : 2_000),
  })
  const fired = useRef<string | null>(null)
  useEffect(() => {
    if (!query.data || ACTIVE.has(query.data.status) || fired.current === query.data.id) return
    fired.current = query.data.id
    onTerminal?.(query.data)
  }, [query.data, onTerminal])
  return query
}
