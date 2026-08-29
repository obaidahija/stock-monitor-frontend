import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAiSettings, getOpenRouterModels, updateAiSettings } from '@/api/ai'

export function useAiSettings() {
  return useQuery({ queryKey: ['ai-settings'], queryFn: getAiSettings })
}

export function useOpenRouterModels(enabled: boolean) {
  return useQuery({
    queryKey: ['ai-settings', 'openrouter-models'],
    queryFn: getOpenRouterModels,
    enabled,
    staleTime: 15 * 60 * 1_000,
  })
}

export function useUpdateAiSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateAiSettings,
    onSuccess: (data) => queryClient.setQueryData(['ai-settings'], data),
  })
}
