import { apiClient } from '@/lib/api-client'
import type { SettingValue, SettingsCategory, SettingsOut } from '@/types/api'

export function getSettings() {
  return apiClient.get<SettingsOut>('/v1/settings')
}

export function getSettingsCategory(name: string) {
  return apiClient.get<SettingsCategory>(`/v1/settings/${name}`)
}

export function updateSettingsCategory(name: string, values: Record<string, SettingValue>) {
  return apiClient.put<SettingsCategory>(`/v1/settings/${name}`, { values })
}

export function resetSettingsCategory(name: string) {
  return apiClient.post<SettingsCategory>(`/v1/settings/${name}/reset`)
}
