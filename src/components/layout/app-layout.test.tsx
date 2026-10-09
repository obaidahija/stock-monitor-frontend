import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AppLayout } from './app-layout'

vi.mock('./ticker-search', () => ({ TickerSearch: () => null }))

afterEach(cleanup)

test('the compact page menu names the current page and lists every page', async () => {
  const user = userEvent.setup()
  renderWithProviders(<AppLayout />, ['/social/reddit'])

  await user.click(screen.getByRole('button', { name: 'Pages: Social' }))

  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Digest', 'Discover', 'Research', 'Watchlists', 'Social', 'Macro', 'Events', 'System', 'Settings',
  ])
})

test('the compact page menu reads "Pages" on a page outside the menu', () => {
  renderWithProviders(<AppLayout />, ['/stocks/NVDA'])

  expect(screen.getByRole('button', { name: 'Pages' })).toBeInTheDocument()
})
