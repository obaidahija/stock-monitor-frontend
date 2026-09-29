import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { EventWindowOut } from '@/types/api'
import { EventWindowCard, eventWindowMessage } from './event-window'

afterEach(cleanup)

const empty: EventWindowOut = {
  window: { horizon_sessions: 5, starts_at: '2026-09-21T14:00:00Z', expires_at: '2026-09-25T20:00:00Z', anchor_session: '2026-09-21', expires_on: '2026-09-25', calendar: 'XNYS', window_version: 'v1' },
  events: [],
  near_after_expiry: [],
  highest_severity: null,
  coverage_status: 'unavailable',
  coverage_sources: [],
  conflicts: [],
  evaluated_at: '2026-09-21T14:00:00Z',
  collection_enabled: false,
  historical_knowledge: false,
}

test('empty calendar never hides incomplete coverage', () => {
  expect(eventWindowMessage(0, 'unavailable')).toBe('Calendar coverage incomplete')
  expect(eventWindowMessage(0, 'complete')).toBe('No listed events found')
})

test('keeps unknown timing, after-expiry and stale coverage explicit', () => {
  renderWithProviders(<EventWindowCard data={{
    ...empty,
    coverage_status: 'stale',
    historical_knowledge: true,
    events: [{
      canonical_key: 'earnings:NVDA:2026Q3', event_type: 'earnings', title: 'NVDA earnings',
      local_date: '2026-09-25', start_at: '2026-09-25T04:00:00Z', end_at: '2026-09-26T04:00:00Z',
      precision: 'date_only', overlap: 'possible_overlap', severity: 'high', status: 'scheduled',
      verification: 'provider_estimated', source_name: 'Finnhub', source_url: 'https://example.com/earnings', timing_reasons: [],
    }],
    near_after_expiry: [{
      canonical_key: 'earnings:OTHER', event_type: 'earnings', title: 'Later earnings',
      local_date: '2026-09-25', start_at: '2026-09-25T20:00:00Z', end_at: '2026-09-26T04:00:00Z',
      precision: 'amc', overlap: 'after_expiry', severity: 'high', status: 'scheduled',
      verification: 'provider_estimated', source_name: 'Finnhub', source_url: null, timing_reasons: [],
    }],
  }} />)
  expect(screen.getByText(/time unknown/i)).toBeInTheDocument()
  expect(screen.getByText(/possible overlap/i)).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /events after this window/i })).toBeInTheDocument()
  expect(screen.getByText(/stale/i)).toBeInTheDocument()
  expect(screen.getByText(/current calendar knowledge/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Finnhub/i })).toHaveAttribute('href', 'https://example.com/earnings')
})
