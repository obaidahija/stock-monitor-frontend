import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearTelegramRoute,
  getTelegramRoutingStatus,
  saveTelegramRoute,
  sendTelegramCategoryTest,
  setupTelegramTopics,
} from '@/api/telegram'
import type { TelegramCategory, TelegramRouteIn, TelegramRouteOut } from '@/types/api'

const STATUS_KEY = ['notifications', 'telegram', 'status']

export function useTelegramStatus(enabled = true) {
  return useQuery({ queryKey: STATUS_KEY, queryFn: getTelegramRoutingStatus, enabled, retry: false })
}

function useInvalidateStatus() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: STATUS_KEY })
}

export function useSaveTelegramRoute() {
  const invalidate = useInvalidateStatus()
  return useMutation({
    mutationFn: ({ category, body }: { category: TelegramCategory; body: TelegramRouteIn }) =>
      saveTelegramRoute(category, body),
    onSuccess: invalidate,
  })
}

export function useClearTelegramRoute() {
  const invalidate = useInvalidateStatus()
  return useMutation({
    mutationFn: (category: TelegramCategory) => clearTelegramRoute(category),
    onSuccess: invalidate,
  })
}

export function useTelegramTest() {
  const invalidate = useInvalidateStatus()
  return useMutation({
    mutationFn: (
      destination: TelegramCategory | Pick<TelegramRouteOut, 'category' | 'source' | 'chat_id' | 'thread_id'>,
    ) => sendTelegramCategoryTest(typeof destination === 'string' ? destination : destination.category),
    onSettled: invalidate,
  })
}

export function useSetupTelegramTopics() {
  const invalidate = useInvalidateStatus()
  return useMutation({
    mutationFn: (chatId?: string) => setupTelegramTopics(chatId),
    onSettled: invalidate,
  })
}
