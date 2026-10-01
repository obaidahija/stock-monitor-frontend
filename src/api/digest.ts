import { apiClient, ApiError } from '@/lib/api-client'
import type { DigestDeliveryOut, DigestItemOut, DigestOut } from '@/types/api'

async function getEdition(path: string, date?: string): Promise<DigestOut | null> {
  try {
    const qs = date ? `?date=${date}` : ''
    return await apiClient.get<DigestOut>(`${path}${qs}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** The morning edition: late, else the preliminary early one, else legacy. */
export function getMorningDigest(date?: string): Promise<DigestOut | null> {
  return getEdition('/v1/digest/morning', date)
}

/** The latest manual or post-open update; never replaces the morning. */
export function getIntradayDigest(date?: string): Promise<DigestOut | null> {
  return getEdition('/v1/digest/intraday', date)
}

export function getTickerDigest(ticker: string) {
  return apiClient.get<DigestItemOut>(`/v1/digest/ticker/${encodeURIComponent(ticker)}`)
}

export function dismissDigestItem(ticker: string) {
  return apiClient.delete<void>(`/v1/digest/${encodeURIComponent(ticker)}`)
}

/** `force` is deliberately not surfaced in the UI -- the manual slot's
 * no-op-if-already-sent is the safe default, and a force control invites
 * double-sending the same brief. Kept as a parameter for non-UI callers. */
export function sendMorningDigest(date?: string, force = false) {
  const qs = new URLSearchParams()
  if (date) qs.set('date', date)
  if (force) qs.set('force', 'true')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiClient.post<DigestDeliveryOut>(`/v1/digest/morning/send${suffix}`)
}
