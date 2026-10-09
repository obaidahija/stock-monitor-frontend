import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useResearchCapabilities } from '@/features/research/hooks'
import { sameTimeVolumeLabel } from '@/features/research/intraday'
import { IntradayControl } from '@/features/research/intraday-control'
import { FollowThroughControl } from '@/features/watchlists/follow-through-control'
import { formatEasternDateTime, formatSignedPct } from '@/lib/format'
import { humanizeLabel } from '@/lib/labels'
import type { CatalystReactionOut, FreshCatalystOut } from '@/types/api'
import { useFreshCatalysts } from './hooks'
import type { FreshCatalystParams } from '@/api/discover'

const CATEGORIES = [
  ['earnings_guidance', 'Earnings & guidance'],
  ['analyst_action', 'Analyst action'],
  ['merger_acquisition', 'Mergers & acquisitions'],
  ['financing_offering_buyback_dividend', 'Financing & capital return'],
  ['legal_action', 'Legal action'],
  ['product_contract_regulatory_approval', 'Product, contract & approval'],
  ['filing_regulatory_action', 'Regulatory action'],
] as const
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORIES)

export function volumeLabel(ratio: number | null): string {
  return ratio === null ? 'Daily volume confirmation pending' : `${ratio.toFixed(2)}x daily volume`
}

function ReactionLine({ reaction, label }: { reaction: CatalystReactionOut; label: string }) {
  return (
    <p className="text-muted-foreground text-xs">
      {label} {formatEasternDateTime(reaction.observed_at)} ·{' '}
      {reaction.reaction_pct === null ? 'Price reaction unavailable' : `${formatSignedPct(reaction.reaction_pct)} since pre-event close`}
      {reaction.reaction_atr !== null && ` · ${reaction.reaction_atr.toFixed(2)} ATR`}
      {' · '}{reaction.price_basis === 'completed_close' && reaction.volume_ratio === null
        ? 'Daily volume comparison unavailable'
        : volumeLabel(reaction.price_basis === 'completed_close' ? reaction.volume_ratio : null)}
    </p>
  )
}

function CatalystRow({ item, horizon, trackingEnabled }: { item: FreshCatalystOut; horizon: string; trackingEnabled: boolean }) {
  const href = item.event.source_url && /^https?:\/\//i.test(item.event.source_url)
    ? item.event.source_url : null
  return (
    <li className="min-w-0 space-y-1 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link className="font-semibold hover:underline" to={`/stocks/${encodeURIComponent(item.ticker)}?tab=analysis&horizon_sessions=${horizon}`}>{item.ticker}</Link>
        <span className="text-muted-foreground text-xs">{CATEGORY_LABELS[item.event.category] ?? humanizeLabel(item.event.category)}</span>
      </div>
      <p className="break-words text-sm">{item.event.headline}</p>
      <p className="text-muted-foreground text-xs">
        Published {item.event.published_at ? formatEasternDateTime(item.event.published_at) : 'time unknown'} · first seen {formatEasternDateTime(item.event.first_seen_at)}
        {' · '}{href ? <a className="underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">{item.event.source_name || 'Source'}</a> : item.event.source_name || 'Source unavailable'}
      </p>
      {item.daily_reaction && <ReactionLine reaction={item.daily_reaction} label="Completed close at" />}
      {item.latest_quote_reaction && <ReactionLine reaction={item.latest_quote_reaction} label="Quote at" />}
      {!item.daily_reaction && !item.latest_quote_reaction && <p className="text-muted-foreground text-xs">{volumeLabel(null)}</p>}
      {item.quality.reasons.length > 0 && <p className="text-muted-foreground text-xs">Data limits: {item.quality.reasons.join(', ').replaceAll('_', ' ')}</p>}
      {item.intraday && (item.intraday.same_time_volume || item.intraday.pre_publication_reference) && (
        <div className="space-y-1">
          {item.intraday.same_time_volume && (
            <p className="text-muted-foreground text-xs">{sameTimeVolumeLabel(item.intraday.same_time_volume)}</p>
          )}
          {item.intraday.pre_publication_reference && (
            <p className="text-muted-foreground text-xs">
              Pre-publication 5-minute close ${item.intraday.pre_publication_reference.close.toFixed(2)} at{' '}
              {formatEasternDateTime(item.intraday.pre_publication_reference.bar_end_at)} (reference only, not the cause of a move)
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {item.intraday && (
          <IntradayControl origin={{ catalyst_candidate_id: item.candidate_id }} subscriptionId={item.intraday.subscription_id} />
        )}
        <FollowThroughControl ticker={item.ticker} origin={{ kind: 'catalyst', candidateId: item.candidate_id }} enabled={trackingEnabled} />
      </div>
    </li>
  )
}

export function FreshCatalystsSection() {
  const capabilities = useResearchCapabilities()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawAge = Number(searchParams.get('catalyst_age'))
  const rawDirection = searchParams.get('catalyst_direction')
  const rawSort = searchParams.get('catalyst_sort')
  const rawPage = Number(searchParams.get('catalyst_page'))
  const params: FreshCatalystParams = {
    ageHours: rawAge === 24 || rawAge === 48 ? rawAge : 72,
    category: searchParams.get('catalyst_category') || undefined,
    direction: rawDirection === 'up' || rawDirection === 'down' ? rawDirection : 'all',
    sort: rawSort === 'volume' ? 'volume' : 'newest',
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: 10,
  }
  function setFilter(key: string, value: string) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('catalyst_page')
      return next
    })
  }
  function setPage(page: number) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('catalyst_page', String(page))
      return next
    })
  }
  const query = useFreshCatalysts(params, capabilities.data !== undefined)
  if (!capabilities.data ||
    (!capabilities.data.catalyst_scanner_enabled && (!query.data || query.data.items.length === 0))) return null
  const horizon = searchParams.get('horizon_sessions') || '5'
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / params.pageSize))
  const selectClass = 'border-input bg-background h-8 max-w-full rounded-md border px-2 text-xs'

  return (
    <section className="space-y-3" aria-label="Fresh catalysts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Fresh catalysts</h2>
        {query.data && <span className="text-muted-foreground text-xs">{query.data.collection_enabled ? 'Scanning cached news' : 'Collection off · cached results'} · coverage {query.data.coverage.status}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="text-muted-foreground flex items-center gap-1 text-xs">Age
          <select className={selectClass} aria-label="Catalyst age" value={params.ageHours} onChange={(event) => setFilter('catalyst_age', event.target.value)}>
            <option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option>
          </select>
        </label>
        <label className="text-muted-foreground flex items-center gap-1 text-xs">Event
          <select className={selectClass} aria-label="Event category" value={params.category || ''} onChange={(event) => setFilter('catalyst_category', event.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-muted-foreground flex items-center gap-1 text-xs">Direction
          <select className={selectClass} aria-label="Observed direction" value={params.direction} onChange={(event) => setFilter('catalyst_direction', event.target.value)}>
            <option value="all">All observed moves</option><option value="up">Up</option><option value="down">Down</option>
          </select>
        </label>
        <label className="text-muted-foreground flex items-center gap-1 text-xs">Sort
          <select className={selectClass} aria-label="Catalyst sort" value={params.sort} onChange={(event) => setFilter('catalyst_sort', event.target.value)}>
            <option value="newest">Newest publication</option><option value="volume">Daily volume</option>
          </select>
        </label>
      </div>
      {query.isPending && <Skeleton className="h-32 rounded-lg" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.items.length === 0 && <p className="text-muted-foreground text-sm">No recent material events match these filters.</p>}
      {query.data && query.data.items.length > 0 && <ul className="grid gap-2 md:grid-cols-2">{query.data.items.map((item) => <CatalystRow key={item.candidate_id} item={item} horizon={horizon} trackingEnabled={capabilities.data?.follow_through_enabled === true} />)}</ul>}
      {query.data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={params.page <= 1} onClick={() => setPage(params.page - 1)}>Previous</Button>
          <span>Page {params.page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={params.page >= totalPages} onClick={() => setPage(params.page + 1)}>Next</Button>
        </div>
      )}
    </section>
  )
}
