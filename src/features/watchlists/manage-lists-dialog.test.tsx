import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { ManageListsDialog } from './manage-lists-dialog'

const add = vi.fn()
const remove = vi.fn()

vi.mock('./hooks', () => {
  const data = [
      { id: 1, name: 'Watchlist', item_count: 1, contains_ticker: true, has_setup: true },
      { id: 2, name: 'Swing', item_count: 0, contains_ticker: false, has_setup: false },
  ]
  return {
    useWatchlists: () => ({ isPending: false, data }),
    useAddWatchlistItem: () => ({ mutateAsync: add, isPending: false }),
    useRemoveWatchlistItem: () => ({ mutateAsync: remove, isPending: false }),
    useCreateWatchlist: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }
})

afterEach(cleanup)

test('confirms destructive membership removal and adds newly selected lists', async () => {
  const user = userEvent.setup()
  render(<ManageListsDialog ticker="NVDA" labeled />)
  await user.click(screen.getByRole('button', { name: /manage nvda watchlists/i }))
  await user.click(screen.getByRole('checkbox', { name: /watchlist/i }))
  await user.click(screen.getByRole('checkbox', { name: /swing/i }))
  await user.click(screen.getByRole('button', { name: /^save$/i }))

  expect(window.confirm).toHaveBeenCalled()
  expect(remove).toHaveBeenCalledWith({ watchlistId: 1, ticker: 'NVDA' })
  expect(add).toHaveBeenCalledWith({ watchlistId: 2, ticker: 'NVDA' })
})
