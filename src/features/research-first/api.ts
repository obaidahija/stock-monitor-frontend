import { apiClient } from '@/lib/api-client'
import type { ResearchFirstReport } from './types'

export function getResearchFirst(horizon: number) {
  return apiClient.get<ResearchFirstReport>(`/v1/discover/research-first?horizon_sessions=${horizon}`)
}
