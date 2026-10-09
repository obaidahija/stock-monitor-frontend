import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getTickerDescription } from '@/api/stocks'
import { renderWithProviders } from '@/test/render'
import { TickerDescription } from './ticker-description'

vi.mock('@/api/stocks', () => ({ getTickerDescription: vi.fn() }))

const description = 'Dycom provides engineering and construction services for telecommunications infrastructure. '
  + 'Its work includes designing, building, installing and maintaining networks for communications providers. '
  + 'The company also supports utility infrastructure through specialist contracting services.'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTickerDescription).mockImplementation(async (ticker) => ({
    ticker, description, fetched_at: '2026-10-09T12:00:00Z', stale: false,
    source_name: 'Yahoo Finance', source_url: `https://finance.yahoo.com/quote/${ticker}/profile/`,
  }))
})
afterEach(cleanup)

test('shows a compact company preview and expands the original description', async () => {
  renderWithProviders(<TickerDescription ticker="DY" />)
  expect(await screen.findByRole('heading', { name: 'About DY' })).toBeInTheDocument()
  expect(screen.queryByText(description)).not.toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Read more' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(button)
  expect(screen.getByText(description)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Yahoo Finance' })).toHaveAttribute('href', 'https://finance.yahoo.com/quote/DY/profile/')
  fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
  expect(screen.queryByText(description)).not.toBeInTheDocument()
  expect(getTickerDescription).toHaveBeenCalledTimes(1)
})

test('shows short descriptions without an unnecessary expansion control', async () => {
  vi.mocked(getTickerDescription).mockResolvedValue({
    ticker: 'DY', description: 'Builds communications networks.', fetched_at: null, stale: false,
    source_name: 'Yahoo Finance', source_url: 'https://finance.yahoo.com/quote/DY/profile/',
  })
  renderWithProviders(<TickerDescription ticker="DY" />)
  expect(await screen.findByText('Builds communications networks.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument()
})

test('resets the expanded state on ticker navigation', async () => {
  const view = renderWithProviders(<TickerDescription ticker="DY" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Read more' }))
  view.rerender(<TickerDescription ticker="UEC" />)
  await screen.findByRole('heading', { name: 'About UEC' })
  expect(screen.getByRole('button', { name: 'Read more' })).toHaveAttribute('aria-expanded', 'false')
})

test('omits an unavailable description without blocking the page', async () => {
  vi.mocked(getTickerDescription).mockResolvedValue({
    ticker: 'DY', description: null, fetched_at: null, stale: false,
    source_name: 'Yahoo Finance', source_url: 'https://finance.yahoo.com/quote/DY/profile/',
  })
  const view = renderWithProviders(<TickerDescription ticker="DY" />)
  await screen.findByRole('status')
  await vi.waitFor(() => expect(view.container).toBeEmptyDOMElement())
})
