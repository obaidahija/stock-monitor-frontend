import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRecheckRedditAuth, useRedditAuth } from './hooks'
import { useRedditOperationPoll } from './use-operation-poll'
import type { RedditAuthState } from '@/types/api'

const STATE_META: Record<RedditAuthState, { label: string; dot: string }> = {
  valid: { label: 'Connected', dot: 'bg-emerald-500' },
  checking: { label: 'Checking…', dot: 'bg-muted-foreground animate-pulse' },
  missing: { label: 'No credentials configured', dot: 'bg-muted-foreground' },
  invalid: { label: 'Invalid credentials', dot: 'bg-red-500' },
  unavailable: { label: 'Reddit CLI unavailable', dot: 'bg-red-500' },
}

/**
 * Compact auth-status badge meant to sit inline next to the page title, mirroring
 * Twitter's AuthStatusIndicator: a glanceable status dot + label, with the recheck
 * action tucked behind hover/focus so it doesn't compete with the title for
 * visual weight. Reddit adds two states Twitter doesn't have -- the feature-flag
 * "disabled" rollout state and the auto-reauth "recovering" state -- both signaled
 * through `public_message` rather than a distinct `state` value.
 */
export function RedditAuthStatusIndicator() {
  const { data, isPending } = useRedditAuth()
  const recheckAuth = useRecheckRedditAuth()
  const poll = useRedditOperationPoll(recheckAuth.data?.operation?.id ?? null)
  const isChecking = recheckAuth.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'

  if (isPending || !data) {
    return <Skeleton className="h-6 w-28 rounded-full" />
  }

  const disabled = data.public_message === 'reddit_intelligence_disabled'
  const recovering = data.state === 'checking' && data.public_message === 'Recovering Reddit authentication...'
  const meta = disabled
    ? { label: 'Disabled', dot: 'bg-muted-foreground' }
    : recovering
      ? { label: 'Recovering…', dot: 'bg-muted-foreground animate-pulse' }
      : STATE_META[data.state]

  const cooldownActive = data.cooldown_until !== null && new Date(data.cooldown_until) > new Date()
  const tooltip = disabled
    ? 'Reddit live collection is disabled. Cached discussions remain available; enable the feature to run live collection.'
    : cooldownActive
      ? `Retry available ${formatRelativeTime(data.cooldown_until)}`
      : (data.public_message ?? 'Reddit auth status') +
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
                aria-label="Recheck Reddit auth"
                disabled={isChecking || cooldownActive || disabled}
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
