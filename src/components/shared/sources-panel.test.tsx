import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { SourcesPanel } from './sources-panel'

afterEach(cleanup)

test('starts closed and opens on demand', async () => {
  const user = userEvent.setup()
  render(
    <SourcesPanel count={3} description="Accounts the feed reads">
      <p>Account list</p>
    </SourcesPanel>,
  )

  const toggle = screen.getByRole('button', { name: /^Sources \(3\)/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Account list')).not.toBeInTheDocument()

  await user.click(toggle)

  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Account list')).toBeInTheDocument()
})

test('leaves the count out until it is known', () => {
  render(
    <SourcesPanel count={null} description="Accounts the feed reads">
      <p>Account list</p>
    </SourcesPanel>,
  )

  expect(screen.getByText('Sources')).toBeInTheDocument()
})
