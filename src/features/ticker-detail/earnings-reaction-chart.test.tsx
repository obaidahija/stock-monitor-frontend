import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { EarningsReactionOut } from '@/types/api'
import { EarningsReactionChart } from './earnings-reaction-chart'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const data = {
  ticker: 'NVDA',
  before_days: 2,
  after_days: 2,
  points: [-2, -1, 0, 1, 2].map((offset) => ({ offset, avg_pct: offset, min_pct: offset - 1, max_pct: offset + 1 })),
  events: [
    {
      event_date: '2026-08-26',
      bmo_amc: 'amc',
      eps_actual: 2.2,
      eps_estimate: 2.1,
      is_upcoming: false,
      pe_ratio: null,
      volume_ratio: null,
      points: [-2, -1, 0, 1, 2].map((offset) => ({ offset, pct: offset })),
    },
  ],
  events_used: 1,
  days_until_next_earnings: 29,
  // Inside the window, so the table has a "today" column it centres on load.
  today_offset: 1,
  current_pe_ratio: null,
  source: { ok: true, error: null },
} as unknown as EarningsReactionOut

test('keeps the report column pinned and never scrolls the page', () => {
  const pageScroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
  render(<EarningsReactionChart data={data} />)

  expect(screen.getByRole('columnheader', { name: 'Report' })).toHaveClass('sticky', 'left-0')
  expect(pageScroll).not.toHaveBeenCalled()
})
