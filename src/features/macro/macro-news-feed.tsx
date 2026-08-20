import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { MacroNewsCard } from './macro-news-card'
import { useMacroNews } from './hooks'

// Opening focus stays the last 24h (the default); these let a reader check
// whether older items still show the same pattern without leaving the page.
const WINDOW_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '3d', hours: 24 * 3 },
  { label: '7d', hours: 24 * 7 },
  { label: '14d', hours: 24 * 14 },
]
const DEFAULT_WINDOW_HOURS = 24

export function MacroNewsFeed() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || undefined
  const hours = Number(searchParams.get('hours')) || DEFAULT_WINDOW_HOURS
  const query = useMacroNews({ category, hours })

  function setHours(nextHours: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nextHours === DEFAULT_WINDOW_HOURS) next.delete('hours')
      else next.set('hours', String(nextHours))
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {query.data ? `${query.data.length} item${query.data.length === 1 ? '' : 's'}` : ''}
        </p>
        <div className="flex items-center gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              size="sm"
              variant={hours === opt.hours ? 'secondary' : 'ghost'}
              onClick={() => setHours(opt.hours)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {query.isPending && <Skeleton className="h-64 rounded-xl" aria-label="Loading macro news" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && query.data.length === 0 && (
        <EmptyState
          title="No macro news in this window"
          description="Try a longer window, or trigger macro_news_ingest from the System page."
        />
      )}
      {query.data && query.data.length > 0 && (
        <div className="space-y-2">
          {query.data.map((item) => (
            <MacroNewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
