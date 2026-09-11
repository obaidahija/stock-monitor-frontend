import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, resetSettingsCategory, updateSettingsCategory } from '@/api/settings'
import type { SettingValue, SettingsCategory, SettingsOut } from '@/types/api'

const SETTINGS_KEY = ['settings']

function replaceCategory(previous: SettingsOut | undefined, updated: SettingsCategory) {
  if (!previous) return previous
  return {
    ...previous,
    categories: previous.categories.map((category) =>
      category.name === updated.name ? updated : category,
    ),
  }
}

export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: getSettings })
}

export function useUpdateSettingsCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, values }: { name: string; values: Record<string, SettingValue> }) =>
      updateSettingsCategory(name, values),
    onSuccess: (updated) =>
      queryClient.setQueryData<SettingsOut>(SETTINGS_KEY, (previous) =>
        replaceCategory(previous, updated),
      ),
  })
}

export function useResetSettingsCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => resetSettingsCategory(name),
    onSuccess: (updated) =>
      queryClient.setQueryData<SettingsOut>(SETTINGS_KEY, (previous) =>
        replaceCategory(previous, updated),
      ),
  })
}
