import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

/**
 * Compact auth-status badge meant to sit inline next to a page title (see
 * ticker-detail-page's industry badge for the same pattern) — a glanceable
 * status dot + label, with the recheck action tucked behind hover/focus so
 * it doesn't compete with the title for visual weight.
 */
export function AuthStatusIndicator() {
  const { data, isPending } = useTwitterAuth()
  const recheckAuth = useRecheckAuth()
  const poll = useTwitterOperationPoll(recheckAuth.data?.operation?.id ?? null)
  const isChecking = recheckAuth.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'

  if (isPending || !data) {
    return <Skeleton className="h-6 w-28 rounded-full" />
  }

  const meta = STATE_META[data.state]
  const cooldownActive = data.cooldown_until !== null && new Date(data.cooldown_until) > new Date()
  const tooltip = cooldownActive
    ? `Retry available ${formatRelativeTime(data.cooldown_until)}`
    : (data.public_message ?? 'Twitter/X auth status') +
      (data.checked_at ? ` · checked ${formatRelativeTime(data.checked_at)}` : '')

  const expanded = isChecking

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'group/auth ring-foreground/10 inline-flex h-6 items-center rounded-full bg-card pl-2.5 text-xs font-normal ring-1 transition-[padding-right] duration-150 ease-out',
            expanded ? 'pr-1' : 'pr-2.5 group-hover/auth:pr-1 group-focus-within/auth:pr-1',
          )}
        >
          <span className={cn('mr-1.5 size-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
          <span className="font-medium">{meta.label}</span>
          <div
            className={cn(
              'grid transition-[grid-template-columns] duration-150 ease-out',
              expanded
                ? 'grid-cols-[1fr]'
                : 'grid-cols-[0fr] group-hover/auth:grid-cols-[1fr] group-focus-within/auth:grid-cols-[1fr]',
            )}
          >
            <div className="overflow-hidden">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Recheck Twitter/X auth"
                disabled={isChecking || cooldownActive}
                onClick={() => recheckAuth.mutate()}
                className="ml-1 size-4 [&_svg]:size-2.5"
              >
                <RefreshCw className={cn(isChecking && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
