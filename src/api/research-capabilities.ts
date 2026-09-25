import { apiClient } from '@/lib/api-client'
import type { ResearchCapabilitiesOut } from '@/types/api'

export function getResearchCapabilities() {
  return apiClient.get<ResearchCapabilitiesOut>('/v1/research-capabilities')
}
