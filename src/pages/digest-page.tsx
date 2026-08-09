import { Newspaper } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DigestItemCard } from '@/features/digest/digest-item-card'
import { useBuildDigest, useMorningDigest } from '@/features/digest/hooks'
import { formatDateTime } from '@/lib/format'

export function DigestPage() {
  const { data: digest, isPending, isError, error, refetch } = useMorningDigest()
  const buildDigest = useBuildDigest()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Morning digest"
        description={
          digest ? `Generated ${formatDateTime(digest.generated_at)}` : 'Top-scored discovery signals'
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

      {digest && digest.payload.items.length === 0 && (
        <EmptyState
          title="No tracked tickers yet"
          description="Scores populate daily once universe_score has run, or pin a ticker on Discover."
        />
      )}

      {digest && digest.payload.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {digest.payload.items.map((item) => (
            <DigestItemCard key={item.ticker} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
