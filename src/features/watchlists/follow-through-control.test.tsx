import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { FollowThroughControl } from './follow-through-control'
import type { WatchlistSetupOut } from '@/types/api'
import {
  useActivateFollowThrough, useFollowThroughDetail, useFollowThroughTracks,
  useStopFollowThrough,
} from './follow-through-hooks'

vi.mock('./follow-through-hooks', () => ({
  useFollowThroughTracks: vi.fn(),
  useFollowThroughDetail: vi.fn(),
  useActivateFollowThrough: vi.fn(),
  useStopFollowThrough: vi.fn(),
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

test('opening a catalyst makes no track and a retry keeps its request key', async () => {
  const mutateAsync = vi.fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ id: 7, ticker: 'ABC' })
  vi.mocked(useFollowThroughTracks).mockReturnValue({
    data: { items: [], total: 0 }, isPending: false, isError: false,
  } as never)
  vi.mocked(useFollowThroughDetail).mockReturnValue({ data: undefined, isPending: false, isError: false } as never)
  vi.mocked(useActivateFollowThrough).mockReturnValue({ mutateAsync, isPending: false } as never)
  vi.mocked(useStopFollowThrough).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never)

  renderWithProviders(<FollowThroughControl ticker="ABC" origin={{ kind: 'catalyst', candidateId: 42 }} enabled />)
  fireEvent.click(screen.getByRole('button', { name: 'Follow-through' }))
  expect(mutateAsync).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Track follow-through' }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: 'Track follow-through' }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))
  expect(mutateAsync.mock.calls[0][0]).toEqual({
    body: { origin: 'catalyst', candidate_id: 42, horizon_sessions: 5 },
    key: mutateAsync.mock.calls[1][0].key,
  })
})

test('a legacy setup recognizes its active track by setup id', async () => {
  const mutateAsync = vi.fn()
  vi.mocked(useFollowThroughTracks).mockReturnValue({
    data: { items: [{ id: 7, setup_id: 20, setup_revision_id: 99, lifecycle: 'active' }], total: 1 },
    isPending: false, isError: false,
  } as never)
  vi.mocked(useFollowThroughDetail).mockReturnValue({ data: undefined, isPending: false, isError: false } as never)
  vi.mocked(useActivateFollowThrough).mockReturnValue({ mutateAsync, isPending: false } as never)
  vi.mocked(useStopFollowThrough).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never)
  const setup = { id: 20, current_revision_id: null } as WatchlistSetupOut
  renderWithProviders(<FollowThroughControl ticker="ABC" origin={{ kind: 'setup', setup }} enabled />)
  fireEvent.click(screen.getByRole('button', { name: 'Follow-through' }))
  expect(screen.getByRole('button', { name: 'View active timeline' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Track follow-through' })).not.toBeInTheDocument()
  expect(mutateAsync).not.toHaveBeenCalled()
})
