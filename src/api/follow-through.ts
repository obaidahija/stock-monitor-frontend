import { apiClient, apiFetch, ApiError } from '@/lib/api-client'
import type {
  FollowThroughCreate,
  FollowThroughDetailOut,
  FollowThroughListOut,
  FollowThroughTrackOut,
} from '@/types/api'

export async function activateFollowThrough(body: FollowThroughCreate, idempotencyKey: string) {
  const response = await apiFetch('/v1/follow-through', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(response.status, payload?.detail ?? payload)
  }
  return (await response.json()) as FollowThroughTrackOut
}

export function listFollowThrough(ticker: string, page = 1) {
  const params = new URLSearchParams({ ticker, page: String(page), page_size: '100' })
  return apiClient.get<FollowThroughListOut>(`/v1/follow-through?${params}`)
}

export function getFollowThrough(id: number) {
  return apiClient.get<FollowThroughDetailOut>(`/v1/follow-through/${id}`)
}

export function stopFollowThrough(id: number) {
  return apiClient.post<FollowThroughTrackOut>(`/v1/follow-through/${id}/stop`)
}
