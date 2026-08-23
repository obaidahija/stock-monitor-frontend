import { useState } from 'react'
import { EllipsisVertical, RefreshCw, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { RedditOperationOut, RedditOperationStatus } from '@/types/api'

const ACTIVE_OPERATION_STATUSES: RedditOperationStatus[] = ['queued', 'running', 'deferred']

export type SourceStatus = 'fetching' | 'error' | 'idle'

export function deriveSourceStatus(operation: RedditOperationOut | null): SourceStatus {
  if (operation && ACTIVE_OPERATION_STATUSES.includes(operation.status)) return 'fetching'
  if (operation?.status === 'failed') return 'error'
  return 'idle'
}

// "30m", "2h", "3d" -- a chip can't afford "30 minutes ago" the way a table cell can.
export function compactAge(iso: string | null): string | null {
  if (!iso) return null
  const diffSeconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  const units: [number, string][] = [
    [31536000, 'y'],
    [2592000, 'mo'],
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
  ]
  for (const [secondsInUnit, suffix] of units) {
    if (diffSeconds >= secondsInUnit) return `${Math.floor(diffSeconds / secondsInUnit)}${suffix}`
  }
  return 'now'
}

const STATUS_DOT: Record<SourceStatus, string> = {
  fetching: 'bg-amber-500 animate-pulse',
  error: 'bg-red-500',
  idle: 'bg-emerald-500',
}

const STATUS_TINT: Record<SourceStatus, string> = {
  fetching: 'bg-amber-500/5 ring-amber-500/15',
  error: 'bg-red-500/5 ring-red-500/20',
  idle: 'ring-foreground/10 hover:ring-emerald-500/30',
}

function SourceMenu({
  label,
  isFetching,
  onRefresh,
  onRemove,
  removeDescription,
  open,
  onOpenChange,
}: {
  label: string
  isFetching: boolean
  onRefresh: () => void
  onRemove: () => void
  removeDescription: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Actions for ${label}`}
            className="pointer-events-none opacity-0 transition-opacity group-hover/source:pointer-events-auto group-hover/source:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100"
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isFetching} onSelect={onRefresh}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
            Refresh now
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {label}?</AlertDialogTitle>
            <AlertDialogDescription>{removeDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Reddit's answer to Twitter's AccountChip -- same rounded-pill look, status dot,
 * and hover-reveal menu. Deliberately narrower than Twitter's: trusted subreddits
 * and authors have no per-source "posts to pull" setting (that's a single global
 * REDDIT_SUBREDDIT_POST_LIMIT/REDDIT_TRUSTED_REFRESH_LIMIT env var, not a per-row
 * column like Twitter's sweep_post_limit), so there's no sweep-limit menu item or
 * dialog here. `onToggleSelected`/`selected` are optional -- pass them (as
 * TrustedSubredditsSection does, mirroring Twitter's `usernames` feed filter) to
 * make the chip click-to-filter; omit them (as trusted authors still do, since
 * the feed has no author filter yet) and the chip stays a plain status pill.
 */
export function SourceChip({
  label,
  status,
  ageLabel,
  errorMessage,
  isFetching,
  onRefresh,
  onRemove,
  removeDescription,
  selected,
  onToggleSelected,
}: {
  label: string
  status: SourceStatus
  ageLabel: string
  errorMessage?: string | null
  isFetching: boolean
  onRefresh: () => void
  onRemove: () => void
  removeDescription: string
  selected?: boolean
  onToggleSelected?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onClick={onToggleSelected}
      role={onToggleSelected ? 'button' : undefined}
      tabIndex={onToggleSelected ? 0 : undefined}
      onKeyDown={
        onToggleSelected
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleSelected()
              }
            }
          : undefined
      }
      aria-pressed={onToggleSelected ? selected : undefined}
      aria-label={onToggleSelected ? `Filter feed by ${label}` : undefined}
      className={cn(
        'group/source inline-flex h-8 items-center gap-1.5 rounded-full bg-card pr-1 pl-2.5 text-sm ring-1 transition-colors select-none',
        STATUS_TINT[status],
        onToggleSelected && 'cursor-pointer',
        selected && 'outline-2 outline-primary outline-offset-1',
      )}
      title={status === 'error' ? (errorMessage ?? undefined) : undefined}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[status])} aria-hidden />
      <span className="font-medium">{label}</span>

      <span className="ml-0.5 grid items-center">
        <span
          className={cn(
            'col-start-1 row-start-1 pointer-events-none text-xs leading-none whitespace-nowrap transition-opacity group-hover/source:opacity-0',
            menuOpen ? 'opacity-0' : 'opacity-100',
            status === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {ageLabel}
        </span>
        {/* stopPropagation so opening/using the menu never also toggles selection --
            mirrors Twitter's AccountChip, which has the identical concern. */}
        <span className="col-start-1 row-start-1 flex items-center" onClick={(e) => e.stopPropagation()}>
          <SourceMenu
            label={label}
            isFetching={isFetching}
            onRefresh={onRefresh}
            onRemove={onRemove}
            removeDescription={removeDescription}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
        </span>
      </span>
    </div>
  )
}
