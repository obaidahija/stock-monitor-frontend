import { apiClient } from '@/lib/api-client'
import type {
  ResearchArchiveDeleteRequest,
  ResearchArchiveDeleteResult,
  ResearchArchiveInventory,
  ResearchArchivePreview,
  ResearchArchiveSelection,
} from '@/types/research-archive'

export function getResearchArchive() {
  return apiClient.get<ResearchArchiveInventory>('/v1/research-archive')
}

export function previewResearchArchive(selection: ResearchArchiveSelection) {
  return apiClient.post<ResearchArchivePreview>('/v1/research-archive/preview', selection)
}

export function deleteResearchArchive(request: ResearchArchiveDeleteRequest) {
  return apiClient.post<ResearchArchiveDeleteResult>('/v1/research-archive/delete', request)
}
