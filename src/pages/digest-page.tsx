import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Newspaper, Send } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { STAGE_META } from '@/components/shared/stage-badge'
import { DigestLiveQuotes } from '@/features/digest/live-quotes'
import { DigestItemCard } from '@/features/digest/digest-item-card'
import { selectDigestPresentation } from '@/features/digest/presentation'
import { sectionMeta, sectionOf } from '@/features/digest/sections'
import { DigestResearchFirst } from '@/features/research-first/research-first-panel'
import {
  useBuildDigest,
  useDigest,
  useSendMorningDigest,
  type DigestView,
} from '@/features/digest/hooks'
import { useTelegramStatus } from '@/features/watchlists/hooks'
import { formatDateTime, formatEasternDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DigestItem, DigestOut } from '@/types/api'

// Stable reference so the useMemo hooks below don't see a "changed" items
// array on every render when there's no digest yet.
const EMPTY_ITEMS: DigestItem[] = []

function editionLabel(digest: DigestOut): string {
  const captured = formatEasternDateTime(digest.capture_completed_at ?? digest.generated_at)
  switch (digest.edition) {
    case 'late':
      return `Morning · late edition · captured ${captured}`
    case 'early':
      return `Morning · preliminary early edition · captured ${captured}; the 09:05 ET refresh has not replaced it`
    case 'legacy':
      return `Legacy digest · captured ${captured}; saved before editions were kept, so it may include post-open data`
    case 'intraday':
      return `Intraday update · captured ${captured}`
    default:
      return `Generated ${formatDateTime(digest.generated_at)}`
  }
}

/** Sections in payload order: the backend already ranked them. */
function DigestSections({ items }: { items: DigestItem[] }) {
  const grouped = new Map<string, DigestItem[]>()
  for (const item of items) {
    const section = sectionOf(item)
    const bucket = grouped.get(section)
    if (bucket) bucket.push(item)
    else grouped.set(section, [item])
  }
  return (
    <>
      {Array.from(grouped, ([section, sectionItems]) => {
        const meta = sectionMeta(section)
        return (
          <section key={section} className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <meta.icon className="text-muted-foreground size-4" />
              {meta.label}
              <span className="text-muted-foreground text-sm font-normal">
                ({sectionItems.length})
              </span>
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sectionItems.map((item) => (
                <DigestItemCard key={item.ticker} item={item} />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

export function DigestPage() {
  // Edition and stage filters live in the URL (not component state) so the
  // back button, a bookmark, or a shared link all restore the same view --
  // same pattern as the Discover table's sort/filter params.
  const [searchParams, setSearchParams] = useSearchParams()
  const edition: DigestView = searchParams.get('edition') === 'intraday' ? 'intraday' : 'morning'
  const { data: digest, isPending, isError, error, refetch } = useDigest(edition)
  const buildDigest = useBuildDigest()
  const sendDigest = useSendMorningDigest()
  const { data: telegram } = useTelegramStatus()
  const [researchTickers, setResearchTickers] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const stageParam = searchParams.get('stages') ?? ''
  const selectedStages = useMemo(() => stageParam.split(',').filter(Boolean), [stageParam])
  const items = digest?.payload.items ?? EMPTY_ITEMS

  const quoteTickers = useMemo(() => [...new Set([
    ...items.map((item) => item.ticker),
    ...Object.values(digest?.payload.research_first ?? {}).flatMap((report) => report.items.map((item) => item.ticker)),
  ])], [items, digest?.payload.research_first])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      for (const stage of item.stages) {
        counts[stage] = (counts[stage] ?? 0) + 1
      }
    }
    return counts
  }, [items])

  const presentation = useMemo(
    () => selectDigestPresentation(items, researchTickers, selectedStages),
    [items, researchTickers, selectedStages],
  )
  const filtering = selectedStages.length > 0
  const showRemaining = !filtering && expanded
  const visibleCount = presentation.prominent.length + (showRemaining ? presentation.remaining.length : 0)
  const remainingFilings = presentation.remaining.filter(
    (item) => sectionOf(item) === 'other_filings',
  ).length

  function setEdition(next: DigestView) {
    setExpanded(false)
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'morning') params.delete('edition')
      else params.set('edition', next)
      return params
    })
  }

  function buildUpdate() {
    // A build is an intraday update; show it, and keep Morning as captured.
    buildDigest.mutate(undefined, { onSuccess: () => setEdition('intraday') })
  }

  function toggleStage(stage: string) {
    // A filter change always lands on the compact view once filters clear.
    setExpanded(false)
    setSearchParams((prev) => {
      const current = new Set(prev.get('stages')?.split(',').filter(Boolean) ?? [])
      if (current.has(stage)) current.delete(stage)
      else current.add(stage)

      const next = new URLSearchParams(prev)
      if (current.size === 0) next.delete('stages')
      else next.set('stages', Array.from(current).join(','))
      return next
    })
  }

  function clearStages() {
    setExpanded(false)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('stages')
      return next
    })
  }

  const buildButton = (
    <Button variant="outline" size="sm" onClick={buildUpdate} disabled={buildDigest.isPending}>
      {buildDigest.isPending ? 'Building…' : 'Build update'}
    </Button>
  )

  return (
    <DigestLiveQuotes tickers={quoteTickers}>
      <div className="space-y-6">
        <PageHeader
          title="Digest"
          description="Signals mixed from score, momentum, volume, chart patterns, and catalysts · Prices refresh every 30 seconds"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1" role="group" aria-label="Digest edition">
                {(['morning', 'intraday'] as const).map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={edition === value ? 'secondary' : 'ghost'}
                    aria-pressed={edition === value}
                    onClick={() => setEdition(value)}
                  >
                    {value === 'morning' ? 'Morning' : 'Intraday'}
                  </Button>
                ))}
              </div>
              {buildButton}
              {edition === 'morning' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendDigest.mutate()}
                  disabled={sendDigest.isPending || !digest || !telegram?.ready}
                  title={
                    !telegram?.ready
                      ? (telegram?.error ?? 'Telegram is not configured')
                      : !digest
                        ? 'Build a digest before sending it'
                        : 'Send this morning edition to Telegram now'
                  }
                >
                  <Send className="size-3.5" />
                  {sendDigest.isPending ? 'Sending…' : 'Send to Telegram'}
                </Button>
              )}
            </div>
          }
        />

        {digest && (
          <p className="text-muted-foreground text-xs" data-testid="digest-edition-label">
            {editionLabel(digest)}
          </p>
        )}

        {edition === 'intraday' && (
          <p className="text-muted-foreground text-xs" data-testid="digest-intraday-send-note">
            Telegram sends the morning edition, not this update. Switch to Morning to send it.
          </p>
        )}

        {edition === 'morning' && sendDigest.isSuccess && (
          <p className="text-muted-foreground text-xs" data-testid="digest-send-result">
            {sendDigest.data.skipped
              ? `Already sent to Telegram today (${sendDigest.data.slot} slot).`
              : sendDigest.data.status === 'sent'
                ? `Sent ${sendDigest.data.messages_sent} of ${sendDigest.data.message_count} messages to Telegram.`
                : `Telegram delivery ${sendDigest.data.status}: ${sendDigest.data.last_error ?? 'unknown error'}`}
          </p>
        )}

        {edition === 'morning' && sendDigest.isError && (
          <p className="text-destructive text-xs" data-testid="digest-send-result">
            Could not send to Telegram: {(sendDigest.error as Error).message}
          </p>
        )}

        {telegram && !telegram.digest_enabled && (
          <p className="text-muted-foreground text-xs" data-testid="digest-schedule-note">
            Scheduled Telegram delivery (07:50 and 09:10 ET) is off. Set DIGEST_TELEGRAM_ENABLED=true
            in the backend .env to turn it on — manual sends work either way.
          </p>
        )}

        {isPending && (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}

        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {!isPending && !isError && !digest && edition === 'morning' && (
          <EmptyState
            icon={Newspaper}
            title="No digest built yet for today"
            description="The morning edition builds at 07:45 ET and refreshes at 09:05 ET on trading days, each time with fresh full-universe premarket prices. A manual build is saved as an intraday update."
            action={buildButton}
          />
        )}

        {!isPending && !isError && !digest && edition === 'intraday' && (
          <EmptyState
            icon={Newspaper}
            title="No intraday update yet for today"
            description="An update is a separate snapshot built on demand; it never replaces the morning edition."
            action={buildButton}
          />
        )}

        {digest && (
          <DigestResearchFirst
            snapshots={digest.payload.research_first}
            onVisibleTickersChange={setResearchTickers}
          />
        )}

        {digest && items.length === 0 && !Object.values(digest.payload.research_first ?? {}).some((report) => report.items.length > 0) && (
          <EmptyState
            title="No tracked tickers yet"
            description="Scores populate daily once universe_score has run, or add a custom ticker on Discover."
          />
        )}

        {digest && items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">Filter by stage</span>
              {Object.keys(STAGE_META)
                .filter((stage) => stageCounts[stage] > 0)
                .map((stage) => {
                  const meta = STAGE_META[stage]
                  const active = selectedStages.includes(stage)
                  return (
                    <Button
                      key={stage}
                      size="sm"
                      variant={active ? 'secondary' : 'ghost'}
                      onClick={() => toggleStage(stage)}
                    >
                      <meta.icon className={cn('size-3.5', active && 'opacity-100')} />
                      {meta.label} ({stageCounts[stage]})
                    </Button>
                  )
                })}
              {filtering && (
                <Button size="sm" variant="ghost" onClick={clearStages}>
                  Clear
                </Button>
              )}
            </div>

            <p className="text-muted-foreground text-xs" data-testid="digest-coverage-count">
              Showing {visibleCount} of {presentation.total} tickers
              {!filtering && !expanded && researchTickers.length > 0 && ' · Research First tickers are not repeated'}
            </p>

            {filtering && presentation.prominent.length === 0 && (
              <EmptyState title="No tickers match the selected stages" />
            )}

            {/* Expanded, the whole payload is one ranked list again, so each
                section appears once instead of split into compact and rest. */}
            <div id="digest-coverage" className="space-y-6">
              <DigestSections items={showRemaining ? items : presentation.prominent} />
            </div>

            {!filtering && presentation.remaining.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                aria-expanded={expanded}
                aria-controls="digest-coverage"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded
                  ? 'Show compact view'
                  : `Show all coverage (${presentation.remaining.length} more${remainingFilings ? `, including ${remainingFilings} other filings` : ''})`}
              </Button>
            )}
          </>
        )}
      </div>
    </DigestLiveQuotes>
  )
}
