import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Newspaper, RefreshCw, Send } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DigestLiveQuotes } from '@/features/digest/live-quotes'
import { DigestSections } from '@/features/digest/digest-sections'
import { selectDigestPresentation } from '@/features/digest/presentation'
import { filterDigestItems, paginateDigestItems, type DigestFilters } from '@/features/digest/browsing'
import { CoverageControls, CoveragePagination } from '@/features/digest/coverage-controls'
import { DIGEST_FILTER_META, stagesForDigestFilter } from '@/features/digest/coverage-filters'
import { normalizeDigestDate } from '@/features/digest/dates'
import { useMarketDate } from '@/features/digest/use-market-date'
import { HiddenDigestTickers } from '@/features/digest/hidden-tickers'
import { DigestResearchFirst } from '@/features/research-first/research-first-panel'
import { useBuildDigest, useDigest, useSendMorningDigest, type DigestView } from '@/features/digest/hooks'
import { useTelegramStatus } from '@/features/watchlists/hooks'
import { formatEasternDateTime } from '@/lib/format'
import type { DigestItem, DigestOut } from '@/types/api'

const EMPTY_ITEMS: DigestItem[] = []

function editionLabel(digest: DigestOut): string {
  const captured = formatEasternDateTime(digest.capture_completed_at ?? digest.generated_at)
  switch (digest.edition) {
    case 'late': return `Morning · late edition · captured ${captured}`
    case 'early': return `Morning · preliminary early edition · captured ${captured}; the 09:05 ET refresh has not replaced it`
    case 'legacy': return `Legacy digest · captured ${captured}; saved before editions were kept, so it may include post-open data`
    case 'intraday': return `Intraday update · captured ${captured}`
    default: return `Generated ${formatEasternDateTime(digest.generated_at)}`
  }
}

export function DigestPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const today = useMarketDate()
  const date = normalizeDigestDate(searchParams.get('date'), today)
  const selectedDate = date ?? today
  const historical = selectedDate !== today
  const edition: DigestView = searchParams.get('edition') === 'intraday' ? 'intraday' : 'morning'
  const { data: digest, isPending, isError, error, refetch, isFetching } = useDigest(edition, date)
  const buildDigest = useBuildDigest()
  const sendDigest = useSendMorningDigest()
  const { data: telegram } = useTelegramStatus()
  const [researchTickers, setResearchTickers] = useState<string[]>([])
  const [researchQuotes, setResearchQuotes] = useState<string[]>([])
  const coverageRef = useRef<HTMLDivElement>(null)
  const items = digest?.payload.items ?? EMPTY_ITEMS
  const stageParam = searchParams.get('stages') ?? ''
  const selectedStages = useMemo(() => [...new Set(stageParam.split(',').filter((stage) => Object.hasOwn(DIGEST_FILTER_META, stage)))], [stageParam])
  const query = searchParams.get('q') ?? ''
  const newOnly = searchParams.get('new') === '1'
  const filters = useMemo(() => ({ stages: selectedStages, query, newOnly }), [selectedStages, query, newOnly])
  const filtering = selectedStages.length > 0 || query.trim().length > 0 || newOnly
  const expanded = searchParams.get('view') === 'all'
  const browsing = filtering || expanded
  const filtered = useMemo(() => filterDigestItems(items, filters), [items, filters])
  const unknownNewnessCount = useMemo(() => newOnly
    ? filterDigestItems(items, { ...filters, newOnly: false }).filter((item) => item.new_today == null).length
    : 0, [items, filters, newOnly])
  const presentation = useMemo(() => selectDigestPresentation(items, researchTickers, []), [items, researchTickers])
  const page = paginateDigestItems(filtered, Number(searchParams.get('page') ?? 1))
  const renderedItems = browsing ? page.items : presentation.prominent
  const quoteTickers = useMemo(() => [...new Set([
    ...renderedItems.map((item) => item.ticker), ...researchQuotes,
  ])], [renderedItems, researchQuotes])
  const dataGaps = (digest?.payload.sources ?? []).filter((source) => !source.ok)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) for (const stage of stagesForDigestFilter(item)) counts[stage] = (counts[stage] ?? 0) + 1
    return counts
  }, [items])

  function changeParams(update: (params: URLSearchParams) => void, replace = false) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      update(next)
      return next
    }, { replace })
  }

  function setEdition(next: DigestView) {
    changeParams((params) => {
      if (next === 'morning') params.delete('edition')
      else params.set('edition', next)
      params.delete('view')
      params.delete('page')
    })
  }

  function buildUpdate() {
    buildDigest.mutate(undefined, { onSuccess: () => changeParams((params) => {
      params.set('edition', 'intraday')
      for (const key of ['date', 'view', 'page', 'stages', 'q', 'new']) params.delete(key)
    }) })
  }

  function changeFilters(change: Partial<DigestFilters>) {
    changeParams((params) => {
      if (change.query !== undefined) {
        if (change.query) params.set('q', change.query)
        else params.delete('q')
      }
      if (change.stages !== undefined) {
        if (change.stages.length) params.set('stages', change.stages.join(','))
        else params.delete('stages')
      }
      if (change.newOnly !== undefined) {
        if (change.newOnly) params.set('new', '1')
        else params.delete('new')
      }
      params.delete('view')
      params.delete('page')
    }, change.query !== undefined)
  }

  function clearFilters() {
    changeParams((params) => { for (const key of ['stages', 'q', 'new', 'view', 'page']) params.delete(key) })
  }

  function changeDate(value: string) {
    changeParams((params) => {
      const next = normalizeDigestDate(value, today)
      if (next && next !== today) params.set('date', next)
      else params.delete('date')
      params.delete('page')
    })
    sendDigest.reset()
  }

  function changePage(next: number) {
    changeParams((params) => params.set('page', String(next)))
    requestAnimationFrame(() => coverageRef.current?.scrollIntoView({ block: 'start' }))
  }

  const buildButton = <Button variant="outline" size="sm" onClick={buildUpdate} disabled={buildDigest.isPending}>
    {buildDigest.isPending ? 'Building…' : historical ? "Build today's update" : 'Build update'}
  </Button>
  const shown = browsing && page.pageCount > 1 ? `${page.start}–${page.end}` : String(renderedItems.length)

  return <DigestLiveQuotes tickers={quoteTickers}>
    <div className="flex flex-col gap-6">
      <PageHeader title="Digest" description="Saved research with current prices, refreshed every 30 seconds."
        actions={<div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Digest edition">
            {(['morning', 'intraday'] as const).map((value) => <Button key={value} size="sm"
              variant={edition === value ? 'secondary' : 'ghost'} aria-pressed={edition === value}
              onClick={() => setEdition(value)}>{value === 'morning' ? 'Morning' : 'Intraday'}</Button>)}
          </div>
          {buildButton}
          {edition === 'morning' && <Button variant="outline" size="sm"
            onClick={() => sendDigest.mutate(selectedDate)} disabled={sendDigest.isPending || !digest || !telegram?.ready}
            title={!telegram?.ready ? telegram?.error ?? 'Telegram is not configured'
              : !digest ? 'There is no morning edition to send for this date' : `Send the ${selectedDate} morning edition to Telegram`}>
            <Send data-icon="inline-start" />{sendDigest.isPending ? 'Sending…' : 'Send to Telegram'}
          </Button>}
        </div>} />

      <div className="flex flex-wrap items-center gap-3">
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="digest-date">Edition date (ET)</FieldLabel>
          <Input id="digest-date" type="date" className="w-40" max={today} value={selectedDate}
            onChange={(event) => changeDate(event.target.value)} />
        </Field>
        {date && <Button variant="ghost" size="sm" onClick={() => changeDate(today)}>Today</Button>}
        <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}
          aria-label="Refresh edition"><RefreshCw data-icon="inline-start" />{isFetching ? 'Refreshing…' : 'Refresh edition'}</Button>
        <HiddenDigestTickers />
      </div>

      {buildDigest.isError && <Alert variant="destructive">
        <AlertTitle>Could not build the update</AlertTitle>
        <AlertDescription>{buildDigest.error.message}</AlertDescription>
      </Alert>}
      {digest && <p className="text-muted-foreground text-xs" data-testid="digest-edition-label">{editionLabel(digest)}</p>}
      {dataGaps.length > 0 && <Alert><AlertTitle>Data gaps in this edition</AlertTitle>
        <AlertDescription data-testid="digest-data-gaps">Data gaps in this edition: {dataGaps.map((source) => source.detail).join('; ')}</AlertDescription>
      </Alert>}
      {edition === 'intraday' && <p className="text-muted-foreground text-xs" data-testid="digest-intraday-send-note">
        Telegram sends the morning edition. Switch to Morning to send it.
      </p>}
      {edition === 'morning' && sendDigest.isSuccess && <p className="text-muted-foreground text-xs" data-testid="digest-send-result">
        {sendDigest.data.skipped ? `Already sent to Telegram for this date (${sendDigest.data.slot} slot).`
          : sendDigest.data.status === 'sent' ? `Sent ${sendDigest.data.messages_sent} of ${sendDigest.data.message_count} messages to Telegram.`
            : `Telegram delivery ${sendDigest.data.status}: ${sendDigest.data.last_error ?? 'unknown error'}`}
      </p>}
      {edition === 'morning' && sendDigest.isError && <p className="text-destructive text-xs" data-testid="digest-send-result">
        Could not send to Telegram: {sendDigest.error.message}
      </p>}
      {telegram && !telegram.digest_enabled && <p className="text-muted-foreground text-xs" data-testid="digest-schedule-note">
        Scheduled Telegram delivery (07:50 and 09:10 ET) is off. Manage delivery in{' '}
        <Link className="underline underline-offset-2" to="/settings">Settings</Link>. Manual sends are available when Telegram is ready.
      </p>}

      {isPending && <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}
      </div>}
      {isError && !digest && <ErrorState error={error} onRetry={() => void refetch()} />}
      {isError && digest && <Alert variant="destructive"><AlertTitle>Edition refresh failed</AlertTitle>
        <AlertDescription>{error.message}. The last saved edition is shown.</AlertDescription></Alert>}
      {!isPending && !isError && !digest && <EmptyState icon={Newspaper}
        title={historical ? `No ${edition === 'morning' ? 'morning edition' : 'intraday update'} saved for ${selectedDate}`
          : edition === 'morning' ? 'No digest built yet for today' : 'No intraday update yet for today'}
        description={edition === 'morning'
          ? 'Morning editions build at 07:45 ET and refresh at 09:05 ET on trading days. A manual build creates today’s intraday update.'
          : 'An update is a separate snapshot built on demand.'} action={buildButton} />}

      {digest && <DigestResearchFirst snapshots={digest.payload.research_first}
        onVisibleTickersChange={setResearchTickers} onQuoteTickersChange={setResearchQuotes} />}
      {digest && items.length === 0 && <EmptyState title="No signals in this edition"
        description="This saved edition has no signal coverage after hidden tickers are removed." />}

      {digest && items.length > 0 && <div ref={coverageRef} className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="font-semibold">Signal coverage</h2>
        <CoverageControls filters={filters} stageCounts={stageCounts} unknownNewnessCount={unknownNewnessCount}
          onChange={changeFilters} onClear={clearFilters} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs" data-testid="digest-coverage-count" role="status">
            Showing {shown} of {filtering ? filtered.length : items.length} {filtering ? 'matches' : 'tickers'}
            {filtering && ` · ${items.length} tickers in this edition`}
            {!browsing && researchTickers.length > 0 && ' · Research First tickers are not repeated'}
          </p>
          {!filtering && presentation.remaining.length > 0 && <Button variant="outline" size="sm"
            aria-expanded={expanded} aria-controls="digest-coverage" onClick={() => changeParams((params) => {
              if (expanded) params.delete('view')
              else params.set('view', 'all')
              params.delete('page')
            })}>{expanded ? 'Show compact view' : `Show all coverage (${items.length})`}</Button>}
        </div>
        {filtering && filtered.length === 0 && <EmptyState title="No tickers match these filters"
          description="Try a different ticker, saved headline, stage, or clear the filters." />}
        <div id="digest-coverage" className="flex flex-col gap-6"><DigestSections items={renderedItems} compact={!browsing} /></div>
        {browsing && <CoveragePagination page={page.page} pageCount={page.pageCount} onChange={changePage} />}
      </div>}
    </div>
  </DigestLiveQuotes>
}
