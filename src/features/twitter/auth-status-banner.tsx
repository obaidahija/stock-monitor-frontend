import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRecheckAuth, useTwitterAuth } from './hooks'
import { useTwitterOperationPoll } from './use-operation-poll'
import type { TwitterAuthState } from '@/types/api'

const STATE_META: Record<TwitterAuthState, { label: string; dot: string }> = {
  valid: { label: 'Connected', dot: 'bg-emerald-500' },
  checking: { label: 'Checking…', dot: 'bg-muted-foreground animate-pulse' },
  missing: { label: 'No credentials configured', dot: 'bg-muted-foreground' },
  invalid: { label: 'Invalid credentials', dot: 'bg-red-500' },
  unavailable: { label: 'Twitter CLI unavailable', dot: 'bg-red-500' },
  rate_limited: { label: 'Rate limited', dot: 'bg-amber-500' },
}

export function AuthStatusBanner() {
  const { data, isPending } = useTwitterAuth()
  const recheckAuth = useRecheckAuth()
  const poll = useTwitterOperationPoll(recheckAuth.data?.operation?.id ?? null)
  const isChecking = recheckAuth.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'

  if (isPending || !data) {
    return <Skeleton className="h-16 rounded-xl" />
  }

  const meta = STATE_META[data.state]
  const cooldownActive = data.cooldown_until !== null && new Date(data.cooldown_until) > new Date()

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden />
          <div>
            <p className="text-sm font-medium">{meta.label}</p>
            <p className="text-muted-foreground text-xs">
              {data.public_message ?? 'Twitter/X auth status'}
              {data.checked_at && ` · checked ${formatRelativeTime(data.checked_at)}`}
            </p>
          </div>
        </div>

        {cooldownActive ? (
          <p className="text-muted-foreground text-xs">
            Retry available {formatRelativeTime(data.cooldown_until)}
          </p>
        ) : (
          <Button size="sm" variant="outline" disabled={isChecking} onClick={() => recheckAuth.mutate()}>
            <RefreshCw className={cn(isChecking && 'animate-spin')} />
            Recheck
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
