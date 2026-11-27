import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { PagedList } from '@/components/shared/paged-list'
import { ErrorState } from '@/components/shared/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { MacroNewsCard } from './macro-news-card'
import { useMacroNews } from './hooks'
import { useOpenMacroItem } from './open-item'

// Opening focus stays the last 24h (the default); these let a reader check
// whether older items still show the same pattern without leaving the page.
const WINDOW_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '3d', hours: 24 * 3 },
  { label: '7d', hours: 24 * 7 },
  { label: '14d', hours: 24 * 14 },
]
const DEFAULT_WINDOW_HOURS = 24
const MACRO_PAGE_SIZE = 20

export function MacroNewsFeed() {
  const [searchParams, setSearchParams] = useSearchParams()
  const hours = Number(searchParams.get('hours')) || DEFAULT_WINDOW_HOURS
  // Relevant-only is the default; ?all=1 shows everything, noise included.
  const relevantOnly = searchParams.get('all') !== '1'
  const query = useMacroNews({ hours, relevantOnly })
  const { open } = useOpenMacroItem()

  function setRelevantOnly(next: boolean) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) params.delete('all')
      else params.set('all', '1')
      return params
    })
  }

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
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Macro news</h2>
          <p className="text-muted-foreground text-xs">
            {query.data ? `${query.data.length} item${query.data.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={relevantOnly ? 'secondary' : 'ghost'}
            aria-pressed={relevantOnly}
            onClick={() => setRelevantOnly(!relevantOnly)}
          >
            Relevant only
          </Button>
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
          description={
            relevantOnly
              ? 'Nothing relevant in this window. Turn off Relevant only to see every headline.'
              : 'Try a longer window, or trigger macro_news_ingest from the System page.'
          }
        />
      )}
      {query.data && query.data.length > 0 && (
        <PagedList key={`${relevantOnly}-${hours}`} items={query.data} pageSize={MACRO_PAGE_SIZE}>
          {(items) => (
            <div className="space-y-2">
              {items.map((item) => (
                <MacroNewsCard
                  key={item.id}
                  item={item}
                  onOpen={(clicked) => open(clicked.id)}
                />
              ))}
            </div>
          )}
        </PagedList>
      )}
    </div>
  )
}
