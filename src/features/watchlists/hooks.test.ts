import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}))

import { useWatchlistItems } from './hooks'

beforeEach(() => {
  mocks.useQuery.mockReset()
})

test('polls the selected watchlist every 10 seconds only while visible', () => {
  useWatchlistItems(42)

  expect(mocks.useQuery).toHaveBeenCalledWith(
    expect.objectContaining({
      queryKey: ['watchlists', 'items', 42],
      enabled: true,
      refetchInterval: 10_000,
      refetchIntervalInBackground: false,
    }),
  )
})
