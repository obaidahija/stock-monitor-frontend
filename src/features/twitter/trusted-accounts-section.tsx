import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { EllipsisVertical, Gauge, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  useAddTrustedAccount,
  useFetchTrustedAccount,
  useRemoveTrustedAccount,
  useTrustedAccounts,
  useUpdateTrustedAccountSweepLimit,
} from './hooks'
import { useTwitterOperationPoll } from './use-operation-poll'
import type { TwitterTrustedAccountOut, TwitterTrustedAccountStatus } from '@/types/api'

const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/

const STATUS_DOT: Record<TwitterTrustedAccountStatus, string> = {
  pending: 'bg-amber-500 animate-pulse',
  active: 'bg-emerald-500',
  invalid: 'bg-red-500',
}

const STATUS_TINT: Record<TwitterTrustedAccountStatus, string> = {
  pending: 'bg-amber-500/5 ring-amber-500/15',
  active: 'ring-foreground/10 hover:ring-emerald-500/30',
  invalid: 'bg-red-500/5 ring-red-500/20',
}

// "30m", "2h", "3d" -- a table cell can afford "30 minutes ago"; a chip can't.
function compactAge(iso: string | null): string | null {
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

function AddTrustedAccountDialog() {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const addTrustedAccount = useAddTrustedAccount()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const normalized = username.trim().replace(/^@/, '')
    if (!USERNAME_RE.test(normalized)) {
      setValidationError('Must be a valid X username (letters, numbers, underscore, 1-15 chars)')
      return
    }
    setValidationError(null)

    addTrustedAccount.mutate(normalized, {
      onSuccess: () => {
        toast.success(`@${normalized} added, validating…`)
        setUsername('')
        setOpen(false)
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError && typeof err.detail === 'string'
            ? err.detail
            : `Failed to add @${normalized}`,
        )
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add trusted account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a trusted account</DialogTitle>
            <DialogDescription>
              MarketScout will poll this account's posts every few hours and score them with
              full source-trust weight.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-4">
            <Label htmlFor="username">X username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username (without @)"
              autoFocus
            />
            {validationError && <p className="text-destructive text-xs">{validationError}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addTrustedAccount.isPending}>
              {addTrustedAccount.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SweepLimitDialog({
  username,
  currentLimit,
  open,
  onOpenChange,
}: {
  username: string
  currentLimit: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [value, setValue] = useState(String(currentLimit))
  const updateSweepLimit = useUpdateTrustedAccountSweepLimit()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      toast.error('Enter a whole number between 1 and 20')
      return
    }
    updateSweepLimit.mutate(
      { username, sweepPostLimit: parsed },
      {
        onSuccess: () => {
          toast.success(`@${username} now pulls ${parsed} post${parsed === 1 ? '' : 's'} per sweep`)
          onOpenChange(false)
        },
        onError: () => toast.error(`Failed to update the sweep limit for @${username}`),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(String(currentLimit))
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Sweep limit for @{username}</DialogTitle>
            <DialogDescription>
              How many of this account's newest posts to pull each time the hourly trusted sweep
              reaches it (1-20).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-4">
            <Label htmlFor="sweep-limit">Posts per sweep</Label>
            <Input
              id="sweep-limit"
              type="number"
              min={1}
              max={20}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateSweepLimit.isPending}>
              {updateSweepLimit.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AccountMenu({
  username,
  sweepPostLimit,
  open,
  onOpenChange,
}: {
  username: string
  sweepPostLimit: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sweepDialogOpen, setSweepDialogOpen] = useState(false)
  const fetchTrustedAccount = useFetchTrustedAccount()
  const removeTrustedAccount = useRemoveTrustedAccount()
  const poll = useTwitterOperationPoll(fetchTrustedAccount.data?.id ?? null)
  const isFetching =
    fetchTrustedAccount.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Actions for @${username}`}
            className="pointer-events-none opacity-0 transition-opacity group-hover/account:pointer-events-auto group-hover/account:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100"
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isFetching}
            onSelect={() =>
              fetchTrustedAccount.mutate(
                { username },
                { onError: () => toast.error(`Failed to trigger a fetch for @${username}`) },
              )
            }
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
            Refresh now
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSweepDialogOpen(true)}>
            <Gauge />
            Sweep limit: {sweepPostLimit}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SweepLimitDialog
        username={username}
        currentLimit={sweepPostLimit}
        open={sweepDialogOpen}
        onOpenChange={setSweepDialogOpen}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove @{username}?</AlertDialogTitle>
            <AlertDialogDescription>
              MarketScout will stop collecting tweets from this account. You can re-add it later,
              but it will need to be re-validated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                removeTrustedAccount.mutate(username, {
                  onSuccess: () => toast.success(`@${username} removed`),
                  onError: () => toast.error(`Failed to remove @${username}`),
                })
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AccountChip({
  account,
  selected,
  onToggleSelected,
}: {
  account: TwitterTrustedAccountOut
  selected: boolean
  onToggleSelected: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const age = compactAge(account.validated_at)
  const label =
    account.status === 'invalid' ? 'error' : account.status === 'pending' ? 'validating' : age

  return (
    <div
      onClick={onToggleSelected}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggleSelected()
        }
      }}
      aria-pressed={selected}
      aria-label={`Filter feed by @${account.username}`}
      className={cn(
        'group/account inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-card pr-1 pl-2.5 text-sm ring-1 transition-colors select-none',
        STATUS_TINT[account.status],
        selected && 'outline-2 outline-primary outline-offset-1',
      )}
      title={account.status === 'invalid' ? (account.public_error_message ?? undefined) : undefined}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[account.status])} aria-hidden />
      <span className="font-medium">@{account.username}</span>

      {/* Same grid cell holds both layers so hovering swaps content without resizing
          the chip or the wrap layout around it; the menu button stays in the tab
          order (opacity, not `hidden`) so keyboard focus can still reach it. Reveal is
          driven only by :hover and the menu's own open state -- deliberately NOT
          group-focus-within, since Radix returns DOM focus to the trigger when the
          menu closes (e.g. after an outside click), which would keep :focus-within
          true on this chip forever and leave the button stuck visible. Fading the
          label also depends on `menuOpen` state (not just CSS :hover) so it stays
          hidden behind the "..." button even after the pointer leaves the chip while
          the (portaled) menu content is still open. */}
      <span className="ml-0.5 grid items-center">
        <span
          className={cn(
            'col-start-1 row-start-1 pointer-events-none text-xs leading-none whitespace-nowrap transition-opacity group-hover/account:opacity-0',
            menuOpen ? 'opacity-0' : 'opacity-100',
            account.status === 'invalid' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
        {/* stopPropagation so opening/using the menu never also toggles this chip's
            selection -- the two are unrelated actions sharing the same small area. */}
        <span
          className="col-start-1 row-start-1 flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <AccountMenu
            username={account.username}
            sweepPostLimit={account.sweep_post_limit}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
        </span>
      </span>
    </div>
  )
}

// Shared with FeedControls/FeedTable via the URL, not props -- both live under
// the same TwitterPage route and read/write this same search param.
const ACCOUNTS_PARAM = 'accounts'

export function useSelectedTrustedAccounts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get(ACCOUNTS_PARAM)?.split(',').filter(Boolean) ?? []

  function setSelected(next: string[]) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next.length > 0) params.set(ACCOUNTS_PARAM, next.join(','))
      else params.delete(ACCOUNTS_PARAM)
      params.delete('page')
      return params
    })
  }

  return { selected, setSelected }
}

export function TrustedAccountsSection() {
  const { data, isPending, isError, error, refetch } = useTrustedAccounts()
  const { selected, setSelected } = useSelectedTrustedAccounts()

  function toggleAccount(username: string) {
    const isSelected = selected.some((u) => u.toLowerCase() === username.toLowerCase())
    setSelected(
      isSelected
        ? selected.filter((u) => u.toLowerCase() !== username.toLowerCase())
        : [...selected, username],
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Trusted accounts</h2>
          {selected.length > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              Filtering feed by {selected.length} account{selected.length > 1 ? 's' : ''}
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-primary hover:underline"
              >
                Clear
              </button>
            </span>
          )}
        </div>
        <AddTrustedAccountDialog />
      </div>

      {isPending && <Skeleton className="h-32 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No trusted accounts yet"
          description="Add an X account to poll its posts every few hours with full source-trust weight."
        />
      )}

      {data && data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.map((account) => (
            <AccountChip
              key={account.id}
              account={account}
              selected={selected.some((u) => u.toLowerCase() === account.username.toLowerCase())}
              onToggleSelected={() => toggleAccount(account.username)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
