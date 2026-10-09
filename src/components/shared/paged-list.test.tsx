import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { PagedList } from './paged-list'

afterEach(cleanup)

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

test('shows one page at a time and moves to the next', async () => {
  const user = userEvent.setup()
  render(
    <PagedList items={range(1, 23)} pageSize={10}>
      {(rows) => <ul>{rows.map((n) => <li key={n}>Row {n}</li>)}</ul>}
    </PagedList>,
  )

  expect(screen.getByText('Showing 1–10 of 23')).toBeInTheDocument()
  expect(screen.getByText('Row 10')).toBeInTheDocument()
  expect(screen.queryByText('Row 11')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Next page' }))

  expect(screen.getByText('Row 11')).toBeInTheDocument()
  expect(screen.getByText('Showing 11–20 of 23')).toBeInTheDocument()
})

test('a single page has no pager', () => {
  render(
    <PagedList items={[1, 2]} pageSize={10}>
      {(rows) => <p>{rows.length} rows</p>}
    </PagedList>,
  )

  expect(screen.getByText('2 rows')).toBeInTheDocument()
  expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
})
