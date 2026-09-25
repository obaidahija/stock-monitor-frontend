import { useQuery } from '@tanstack/react-query'
import { getEventWindow } from '@/api/stocks'
import { useResearchCapabilities } from '@/features/research/hooks'
import { formatDate } from '@/lib/format'

const MACRO_TYPES = new Set(['fomc', 'cpi', 'employment', 'rates_fed'])

export function UpcomingMacroEvents() {
  const capabilities = useResearchCapabilities()
  const enabled = capabilities.data?.swing_research_enabled === true && capabilities.data?.event_window_v2_enabled === true
  const query = useQuery({
    queryKey: ['event-window', 'market-macro', 7],
    queryFn: () => getEventWindow('SPY', 7),
    enabled,
  })
  if (!enabled || !query.data) return null
  const events = query.data.events.filter((event) => MACRO_TYPES.has(event.event_type))
  if (events.length === 0 && query.data.coverage_status === 'complete') return null
  return (
    <section aria-label="Upcoming market events" className="space-y-1 rounded-lg border px-4 py-3 text-sm">
      <h2 className="font-medium">Upcoming market events · next 7 sessions</h2>
      {events.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {events.map((event) => <li key={event.canonical_key}>{formatDate(event.local_date)} · {event.title}{event.precision === 'date_only' ? ' · time unknown' : ''}</li>)}
        </ul>
      ) : <p className="text-muted-foreground">Calendar coverage incomplete</p>}
      {query.data.coverage_status !== 'complete' && <p className="text-muted-foreground text-xs">Calendar coverage: {query.data.coverage_status}</p>}
    </section>
  )
}
