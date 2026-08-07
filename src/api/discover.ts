import { apiClient } from '@/lib/api-client'
import type { FilingOut, GapperOut, UnusualVolumeOut } from '@/types/api'

export function getNotableFilings() {
  return apiClient.get<FilingOut[]>('/v1/discover/filings')
}

export function getGappers(minGapPct = 3) {
  return apiClient.get<GapperOut[]>(`/v1/discover/gappers?min_gap_pct=${minGapPct}`)
}

export function getUnusualVolume(minRatio = 2) {
  return apiClient.get<UnusualVolumeOut[]>(`/v1/discover/unusual-volume?min_ratio=${minRatio}`)
}
