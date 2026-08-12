import { useSearchParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRefreshFeed } from './hooks'
import type { TwitterFeedFilter, TwitterSort } from '@/api/twitter'

const FILTER_OPTIONS: { label: string; value: TwitterFeedFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Trusted', value: 'trusted' },
  { label: 'Viral', value: 'viral' },
]

const SORT_OPTIONS: { label: string; value: TwitterSort }[] = [
  { label: 'Signal', value: 'signal' },
  { label: 'Newest', value: 'newest' },
  { label: 'Virality', value: 'virality' },
]

export function FeedControls({ onRefreshed }: { onRefreshed: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = (searchParams.get('filter') as TwitterFeedFilter) || 'all'
  const sort = (searchParams.get('sort') as TwitterSort) || 'signal'
  const refreshFeed = useRefreshFeed()

  function updateParams(updates: Record<string, string | undefined>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) next.delete(key)
        else next.set(key, value)
      }
      next.delete('page')
      return next
    })
  }

  function runRefresh() {
    refreshFeed.mutate(undefined, {
      onSuccess: () => {
        toast.success('Feed refresh triggered')
        onRefreshed()
      },
      onError: () => toast.error('Failed to refresh feed'),
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={filter === opt.value ? 'secondary' : 'ghost'}
              onClick={() => updateParams({ filter: opt.value === 'all' ? undefined : opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground text-xs">Sort</span>
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={sort === opt.value ? 'secondary' : 'ghost'}
              onClick={() => updateParams({ sort: opt.value === 'signal' ? undefined : opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <Button size="sm" variant="outline" disabled={refreshFeed.isPending} onClick={runRefresh}>
        <RefreshCw className={cn(refreshFeed.isPending && 'animate-spin')} />
        Refresh feed
      </Button>
    </div>
  )
}
