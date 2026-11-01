import { useEffect, useReducer } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getFinancialHistory, getFinancialRefresh, refreshFinancialHistory } from '@/api/sec-fundamentals'
import type { FinancialHistoryOut, FinancialPeriod, FinancialRefresh } from '@/types/sec-fundamentals'

const active = (state?: string) => state === 'queued' || state === 'running'
const terminal = (state?: string) => state === 'completed' || state === 'failed'

function newerRequest(incoming: FinancialRefresh, current?: FinancialRefresh) {
  if (!current?.request_id) return true
  if (current.requested_at) {
    return incoming.requested_at != null
      && Date.parse(incoming.requested_at) > Date.parse(current.requested_at)
  }
  // Older servers cannot order request IDs. Keep following active work.
  return !active(current.state)
}

type RefreshSelection = {
  request?: FinancialRefresh
  previousRequestIds: string[]
}
type RefreshEvent =
  | { type: 'manual'; request: FinancialRefresh; previousRequestIds: Array<string | null | undefined> }
  | { type: 'observed'; request?: FinancialRefresh; status?: FinancialRefresh; pending: boolean }

function selectRefresh(state: RefreshSelection, event: RefreshEvent): RefreshSelection {
  if (event.type === 'manual') {
    const previous = [...state.previousRequestIds, state.request?.request_id, ...event.previousRequestIds]
    return {
      request: event.request,
      previousRequestIds: [...new Set(previous.filter((id): id is string => Boolean(id) && id !== event.request.request_id))],
    }
  }
  let request = state.request
  // A terminal observation cannot regress to an older queued/running response.
  for (const observed of [event.status, event.request]) {
    if (observed?.request_id && observed.request_id === request?.request_id
      && (active(request.state) || !active(observed.state))) {
      request = !observed.requested_at && request.requested_at
        ? { ...observed, requested_at: request.requested_at } : observed
    }
  }
  const incoming = event.request
  if (!event.pending && incoming?.request_id && incoming.request_id !== request?.request_id
    && !state.previousRequestIds.includes(incoming.request_id)
    && newerRequest(incoming, request)) {
    return {
      request: incoming,
      previousRequestIds: request?.request_id
        ? [...state.previousRequestIds, request.request_id] : state.previousRequestIds,
    }
  }
  return request === state.request ? state : { ...state, request }
}

export function useFinancialHistory(ticker: string, period: FinancialPeriod) {
  return useQuery({
    queryKey: ['sec-fundamentals', ticker.toUpperCase(), period, 24],
    // Cached GET only, including focus/refetch. Collection requires the explicit mutation.
    queryFn: () => getFinancialHistory(ticker, period, 24),
    retry: false,
  })
}

export function useFinancialRefresh(ticker: string, savedRefresh?: FinancialRefresh) {
  const queryClient = useQueryClient()
  const [selection, select] = useReducer(selectRefresh, {
    request: savedRefresh, previousRequestIds: [],
  })
  const refresh = useMutation({
    mutationFn: () => refreshFinancialHistory(ticker),
    retry: false,
    onMutate: (): { previousRequestIds: Array<string | null | undefined> } => ({
      previousRequestIds: [savedRefresh?.request_id, ...queryClient
        .getQueriesData<FinancialHistoryOut>({ queryKey: ['sec-fundamentals', ticker.toUpperCase()] })
        .map(([, history]) => history?.refresh?.request_id)],
    }),
    onSuccess: (result, _variables, context) => {
      select({ type: 'manual', request: result, previousRequestIds: context?.previousRequestIds ?? [] })
      if (terminal(result.state)) {
        void queryClient.invalidateQueries({ queryKey: ['sec-fundamentals', result.ticker.toUpperCase()] })
      }
    },
  })
  const request = selection.request
  const requestId = request?.request_id
  const status = useQuery({
    queryKey: ['sec-fundamentals-refresh', ticker.toUpperCase(), requestId],
    queryFn: () => getFinancialRefresh(ticker, requestId!),
    enabled: Boolean(requestId) && active(request?.state),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => active(query.state.data?.state) ? 2000 : false,
  })
  const result = active(request?.state) ? status.data ?? request : request
  useEffect(() => {
    select({ type: 'observed', request: savedRefresh, status: status.data, pending: refresh.isPending })
  }, [savedRefresh, status.data, refresh.isPending])
  useEffect(() => {
    if (terminal(status.data?.state) && status.data) {
      void queryClient.invalidateQueries({ queryKey: ['sec-fundamentals', status.data.ticker.toUpperCase()] })
    }
  }, [queryClient, status.data])

  return { refresh, status, result, isRefreshing: refresh.isPending || active(result?.state) }
}
