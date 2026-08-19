import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRedditAuth, useRecheckRedditAuth } from './hooks'

export function RedditAuthStatusBanner() {
  const auth = useRedditAuth()
  const recheck = useRecheckRedditAuth()
  if (auth.isPending || !auth.data) return <Skeleton className="h-16" aria-label="Loading Reddit status" />
  const disabled = auth.data.public_message === 'reddit_intelligence_disabled'
  const recovering =
    auth.data.state === 'checking' &&
    auth.data.public_message === 'Recovering Reddit authentication...'
  const cooldown = auth.data.state === 'invalid' ? auth.data.cooldown_until : null
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {disabled
              ? 'Reddit live collection is disabled'
              : recovering
                ? 'Recovering Reddit authentication…'
                : `Reddit: ${auth.data.state}`}
          </p>
          <p className="text-muted-foreground text-xs">
            {disabled
              ? 'Cached Reddit discussions remain available. Enable the feature to run live collection.'
              : recovering
                ? 'Cached discussions remain available.'
                : auth.data.public_message ?? 'Reddit public-read status'}
          </p>
          {cooldown && (
            <>
              <p className="text-muted-foreground text-xs">
                Automatic recovery paused until {formatDateTime(cooldown)}.
              </p>
              <p className="text-muted-foreground text-xs">Cached discussions remain available.</p>
            </>
          )}
        </div>
        <Button variant="outline" size="sm" disabled={disabled || recheck.isPending} onClick={() => recheck.mutate()}>
          <RefreshCw className={cn(recheck.isPending && 'animate-spin')} /> Recheck
        </Button>
      </CardContent>
    </Card>
  )
}
