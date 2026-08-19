import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { RedditMonitoringButton } from './universe-table'

test('provides a Reddit-specific monitoring control for a universe row', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()

  render(
    <RedditMonitoringButton ticker="NVDA" enabled={false} pending={false} onToggle={onToggle} />,
  )

  await user.click(screen.getByRole('button', { name: 'Monitor NVDA on Reddit' }))
  expect(onToggle).toHaveBeenCalledOnce()
})
