import { apiClient, ApiError } from '@/lib/api-client'
import type { DigestItemOut, DigestOut } from '@/types/api'

export async function getMorningDigest(date?: string): Promise<DigestOut | null> {
  try {
    const qs = date ? `?date=${date}` : ''
    return await apiClient.get<DigestOut>(`/v1/digest/morning${qs}`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export function getTickerDigest(ticker: string) {
  return apiClient.get<DigestItemOut>(`/v1/digest/ticker/${encodeURIComponent(ticker)}`)
}
