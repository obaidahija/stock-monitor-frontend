import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

function applySaved(queryClient: QueryClient, updated: SettingsCategory) {
  queryClient.setQueryData<SettingsOut>(SETTINGS_KEY, (previous) =>
    replaceCategory(previous, updated),
  )
  // Feature switches apply on save without a restart; let every screen that
  // shows or hides research controls see the change at once.
  void queryClient.invalidateQueries({ queryKey: ['research-capabilities'] })
}

export function useUpdateSettingsCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, values }: { name: string; values: Record<string, SettingValue> }) =>
      updateSettingsCategory(name, values),
    onSuccess: (updated) => applySaved(queryClient, updated),
  })
}

export function useResetSettingsCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => resetSettingsCategory(name),
    onSuccess: (updated) => applySaved(queryClient, updated),
  })
}
