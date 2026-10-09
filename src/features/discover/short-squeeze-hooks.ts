import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getShortSqueezeDetail, getShortSqueezes } from '@/api/short-squeeze'
import type {
  ShortSqueezeParams,
  ShortSqueezeSort,
  ShortSqueezeStatusFilter,
} from '@/types/short-squeeze'

export const SHORT_SQUEEZE_PAGE_SIZE = 10
const STATUSES: readonly ShortSqueezeStatusFilter[] = ['matched', 'incomplete', 'all']
const SORTS: readonly ShortSqueezeSort[] = ['move', 'short_float', 'days_to_cover', 'ticker']

/** The section's URL state; anything unrecognized falls back to the defaults. */
export function readShortSqueezeParams(searchParams: URLSearchParams): ShortSqueezeParams {
  const status = searchParams.get('squeeze_status') as ShortSqueezeStatusFilter | null
  const sort = searchParams.get('squeeze_sort') as ShortSqueezeSort | null
  const page = Number(searchParams.get('squeeze_page'))
  return {
    status: status && STATUSES.includes(status) ? status : 'matched',
    sort: sort && SORTS.includes(sort) ? sort : 'move',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: SHORT_SQUEEZE_PAGE_SIZE,
  }
}

export function useShortSqueezes(params: ShortSqueezeParams, enabled: boolean) {
  return useQuery({
    queryKey: ['discover', 'short-squeezes', params],
    queryFn: () => getShortSqueezes(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/**
 * One frozen evaluation. Deliberately no placeholder: a different id must
 * never show the previous evaluation's evidence while it loads.
 */
export function useShortSqueezeDetail(evaluationId: number | null) {
  return useQuery({
    queryKey: ['discover', 'short-squeezes', 'detail', evaluationId],
    queryFn: () => getShortSqueezeDetail(evaluationId as number),
    enabled: evaluationId !== null,
  })
}
