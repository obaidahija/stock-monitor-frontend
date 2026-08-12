import { useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
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
  AlertDialogTrigger,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  useAddTrustedAccount,
  useFetchTrustedAccount,
  useRemoveTrustedAccount,
  useTrustedAccounts,
} from './hooks'
import { useTwitterOperationPoll } from './use-operation-poll'
import type { TwitterTrustedAccountStatus } from '@/types/api'

const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/

const STATUS_META: Record<TwitterTrustedAccountStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  invalid: 'bg-red-500/15 text-red-600 dark:text-red-400',
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

function RemoveAccountAlert({ username }: { username: string }) {
  const removeTrustedAccount = useRemoveTrustedAccount()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove @${username}`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
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
  )
}

function FetchNowButton({ username }: { username: string }) {
  const fetchTrustedAccount = useFetchTrustedAccount()
  const poll = useTwitterOperationPoll(fetchTrustedAccount.data?.id ?? null)
  const isRunning =
    fetchTrustedAccount.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Fetch tweets for @${username} now`}
      disabled={isRunning}
      onClick={() =>
        fetchTrustedAccount.mutate(
          { username },
          {
            onError: () => toast.error(`Failed to trigger a fetch for @${username}`),
          },
        )
      }
    >
      <RefreshCw className={cn(isRunning && 'animate-spin')} />
    </Button>
  )
}

export function TrustedAccountsSection() {
  const { data, isPending, isError, error, refetch } = useTrustedAccounts()

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Trusted accounts</h2>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Validated</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">@{account.username}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      STATUS_META[account.status],
                    )}
                  >
                    {account.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeTime(account.validated_at)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate text-xs">
                  {account.public_error_message ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <FetchNowButton username={account.username} />
                    <RemoveAccountAlert username={account.username} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
