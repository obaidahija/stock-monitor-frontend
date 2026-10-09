import { apiClient } from '@/lib/api-client'
import type {
  ShortSqueezeDetailOut,
  ShortSqueezeListOut,
  ShortSqueezeParams,
} from '@/types/short-squeeze'

/** The latest published daily scan. Cached on the server: never recomputed here. */
export function getShortSqueezes(params: ShortSqueezeParams) {
  const qs = new URLSearchParams({
    status: params.status,
    sort: params.sort,
    page: String(params.page),
    page_size: String(params.pageSize),
  })
  return apiClient.get<ShortSqueezeListOut>(`/v1/discover/short-squeezes?${qs.toString()}`)
}

export function getShortSqueezeDetail(evaluationId: number) {
  return apiClient.get<ShortSqueezeDetailOut>(`/v1/discover/short-squeezes/${evaluationId}`)
}
