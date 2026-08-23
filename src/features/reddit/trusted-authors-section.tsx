import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
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
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { ApiError } from '@/lib/api-client'
import { redditKeys, useAuthorMutations, useTrustedAuthors } from './hooks'
import { compactAge, deriveSourceStatus, SourceChip } from './trusted-source-chip'
import { useRedditOperationPoll } from './use-operation-poll'
import type { RedditTrustedAuthorOut } from '@/types/api'

const USER_RE = /^[A-Za-z0-9_-]{3,20}$/

function AddTrustedAuthorDialog() {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const mutations = useAuthorMutations()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const normalized = username.trim().toLowerCase()
    if (!USER_RE.test(normalized)) {
      setValidationError('Use a plain Reddit username (3-20 characters).')
      return
    }
    setValidationError(null)

    mutations.add.mutate(normalized, {
      onSuccess: () => {
        toast.success(`u/${normalized} added`)
        setUsername('')
        setOpen(false)
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError && typeof err.detail === 'string'
            ? err.detail
            : `Failed to add u/${normalized}`,
        )
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add trusted author
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a trusted author</DialogTitle>
            <DialogDescription>
              MarketScout will poll this author's newest posts every 2 hours and score them with
              full source-trust weight, without requesting their comment history.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-4">
            <Label htmlFor="author-username">Reddit username</Label>
            <Input
              id="author-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoFocus
            />
            {validationError && <p className="text-destructive text-xs">{validationError}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutations.add.isPending}>
              {mutations.add.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AuthorChip({ source }: { source: RedditTrustedAuthorOut }) {
  const mutations = useAuthorMutations()
  const queryClient = useQueryClient()
  const poll = useRedditOperationPoll(mutations.fetch.data?.id ?? null, () =>
    queryClient.invalidateQueries({ queryKey: redditKeys.authors }),
  )
  const isFetching =
    mutations.fetch.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'
  const status = deriveSourceStatus(source.operation)

  return (
    <SourceChip
      label={`u/${source.username}`}
      status={status}
      ageLabel={compactAge(source.last_successful_fetch_at) ?? 'never fetched'}
      errorMessage={source.operation?.public_error_message}
      isFetching={isFetching}
      onRefresh={() =>
        mutations.fetch.mutate(source.username, {
          onError: () => toast.error(`Failed to trigger a fetch for u/${source.username}`),
        })
      }
      onRemove={() =>
        mutations.remove.mutate(source.username, {
          onSuccess: () => toast.success(`u/${source.username} removed`),
          onError: () => toast.error(`Failed to remove u/${source.username}`),
        })
      }
      removeDescription="MarketScout will stop collecting posts from this author. You can re-add them later."
    />
  )
}

export function TrustedAuthorsSection() {
  const query = useTrustedAuthors()

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Trusted authors</h2>
        <AddTrustedAuthorDialog />
      </div>

      {query.isPending && <Skeleton className="h-8 w-full rounded-full" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && query.data.length === 0 && (
        <EmptyState
          title="No trusted authors"
          description="Add Reddit authors to collect their posts without requesting comment history."
        />
      )}

      {query.data && query.data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {query.data.map((source) => (
            <AuthorChip key={source.username} source={source} />
          ))}
        </div>
      )}
    </section>
  )
}
