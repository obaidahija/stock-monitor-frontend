import { useMemo, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { STAGE_META } from '@/components/shared/stage-badge'
import { DIGEST_TIER_ORDER, TIER_META } from '@/components/shared/tier-badge'
import { DigestItemCard } from '@/features/digest/digest-item-card'
import { useBuildDigest, useMorningDigest } from '@/features/digest/hooks'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DigestItem } from '@/types/api'

// Tier 8 ("Tracked", nothing notable today) tends to be the largest and
// least interesting bucket -- start it collapsed so the page opens on the
// tiers that actually carry a signal.
const COLLAPSED_BY_DEFAULT_TIER = 8

// Stable reference so the useMemo hooks below don't see a "changed" items
// array on every render when there's no digest yet.
const EMPTY_ITEMS: DigestItem[] = []

export function DigestPage() {
  const { data: digest, isPending, isError, error, refetch } = useMorningDigest()
  const buildDigest = useBuildDigest()
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const [expandCollapsedTier, setExpandCollapsedTier] = useState(false)

  const items = digest?.payload.items ?? EMPTY_ITEMS

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      for (const stage of item.stages) {
        counts[stage] = (counts[stage] ?? 0) + 1
      }
    }
    return counts
  }, [items])

  const filteredItems = useMemo(() => {
    if (selectedStages.size === 0) return items
    return items.filter((item) => item.stages.some((stage) => selectedStages.has(stage)))
  }, [items, selectedStages])

  const itemsByTier = useMemo(() => {
    const grouped = new Map<number, DigestItem[]>()
    for (const item of filteredItems) {
      const bucket = grouped.get(item.tier)
      if (bucket) bucket.push(item)
      else grouped.set(item.tier, [item])
    }
    return grouped
  }, [filteredItems])

  function toggleStage(stage: string) {
    setSelectedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Morning digest"
        description={
          digest
            ? `Generated ${formatDateTime(digest.generated_at)} · ${items.length} tickers`
            : 'Signals mixed from score, momentum, volume, chart patterns, and catalysts'
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => buildDigest.mutate()}
            disabled={buildDigest.isPending}
          >
            {buildDigest.isPending ? 'Building…' : 'Build now'}
          </Button>
        }
      />

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isPending && !isError && !digest && (
        <EmptyState
          icon={Newspaper}
          title="No digest built yet for today"
          description="The digest_build job runs automatically at 07:45 ET on weekdays, or trigger it now."
          action={
            <Button size="sm" onClick={() => buildDigest.mutate()} disabled={buildDigest.isPending}>
              {buildDigest.isPending ? 'Building…' : 'Build now'}
            </Button>
          }
        />
      )}

      {digest && items.length === 0 && (
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
                const active = selectedStages.has(stage)
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
            {selectedStages.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelectedStages(new Set())}>
                Clear
              </Button>
            )}
          </div>

          {filteredItems.length === 0 && (
            <EmptyState title="No tickers match the selected stages" />
          )}

          {DIGEST_TIER_ORDER.map((tier) => {
            const tierItems = itemsByTier.get(tier)
            if (!tierItems || tierItems.length === 0) return null

            const meta = TIER_META[tier]
            const isCollapsedTier = tier === COLLAPSED_BY_DEFAULT_TIER
            const collapsed = isCollapsedTier && !expandCollapsedTier

            return (
              <section key={tier} className="space-y-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <meta.icon className="text-muted-foreground size-4" />
                  {meta.label}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({tierItems.length})
                  </span>
                </h2>

                {collapsed ? (
                  <Button size="sm" variant="ghost" onClick={() => setExpandCollapsedTier(true)}>
                    Show {tierItems.length} more tracked tickers
                  </Button>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {tierItems.map((item) => (
                      <DigestItemCard key={item.ticker} item={item} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
