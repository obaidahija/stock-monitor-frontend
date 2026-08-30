import { apiClient } from '@/lib/api-client'
import type { AiSettingsOut, AiSettingsUpdate, OpenRouterModelOut } from '@/types/api'

export function getAiSettings() {
  return apiClient.get<AiSettingsOut>('/v1/ai/settings')
}

export function updateAiSettings(settings: AiSettingsUpdate) {
  return apiClient.put<AiSettingsOut>('/v1/ai/settings', settings)
}

export function getOpenRouterModels() {
  return apiClient.get<OpenRouterModelOut[]>('/v1/ai/models/openrouter')
}
