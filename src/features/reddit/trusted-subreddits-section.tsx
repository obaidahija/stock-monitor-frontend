import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
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
import { redditKeys, useSubredditMutations, useTrustedSubreddits } from './hooks'
import { compactAge, deriveSourceStatus, SourceChip } from './trusted-source-chip'
import { useRedditOperationPoll } from './use-operation-poll'
import type { RedditTrustedSubredditOut } from '@/types/api'

const NAME_RE = /^[A-Za-z0-9_]{2,21}$/

function AddTrustedSubredditDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const mutations = useSubredditMutations()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const normalized = name.trim().toLowerCase()
    if (!NAME_RE.test(normalized)) {
      setValidationError('Use a plain subreddit name (2-21 characters).')
      return
    }
    setValidationError(null)

    mutations.add.mutate(
      { name: normalized, sort: 'new' },
      {
        onSuccess: () => {
          toast.success(`r/${normalized} added`)
          setName('')
          setOpen(false)
        },
        onError: (err) => {
          toast.error(
            err instanceof ApiError && typeof err.detail === 'string'
              ? err.detail
              : `Failed to add r/${normalized}`,
          )
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add trusted subreddit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a trusted subreddit</DialogTitle>
            <DialogDescription>
              MarketScout will poll this subreddit's newest posts every 30 minutes and score them
              with full source-trust weight.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-4">
            <Label htmlFor="subreddit-name">Subreddit name</Label>
            <Input
              id="subreddit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="wallstreetbets"
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

function SubredditChip({
  source,
  selected,
  onToggleSelected,
}: {
  source: RedditTrustedSubredditOut
  selected: boolean
  onToggleSelected: () => void
}) {
  const mutations = useSubredditMutations()
  const queryClient = useQueryClient()
  const poll = useRedditOperationPoll(mutations.fetch.data?.id ?? null, () =>
    queryClient.invalidateQueries({ queryKey: redditKeys.subreddits }),
  )
  const isFetching =
    mutations.fetch.isPending || poll.data?.status === 'running' || poll.data?.status === 'queued'
  const status = deriveSourceStatus(source.operation)

  return (
    <SourceChip
      label={`r/${source.name}`}
      status={status}
      ageLabel={compactAge(source.last_successful_fetch_at) ?? 'never fetched'}
      errorMessage={source.operation?.public_error_message}
      isFetching={isFetching}
      selected={selected}
      onToggleSelected={onToggleSelected}
      onRefresh={() =>
        mutations.fetch.mutate(
          { name: source.name, sort: source.default_sort },
          { onError: () => toast.error(`Failed to trigger a fetch for r/${source.name}`) },
        )
      }
      onRemove={() =>
        mutations.remove.mutate(source.name, {
          onSuccess: () => toast.success(`r/${source.name} removed`),
          onError: () => toast.error(`Failed to remove r/${source.name}`),
        })
      }
      removeDescription="MarketScout will stop collecting posts from this subreddit. You can re-add it later."
    />
  )
}

// Shared with FeedControls/RedditFeedList via the URL, not props -- both live
// under the same RedditPage route and read/write this same search param.
// Mirrors Twitter's `accounts` param / useSelectedTrustedAccounts exactly.
const SUBREDDITS_PARAM = 'subreddits'

export function useSelectedTrustedSubreddits() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get(SUBREDDITS_PARAM)?.split(',').filter(Boolean) ?? []

  function setSelected(next: string[]) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next.length > 0) params.set(SUBREDDITS_PARAM, next.join(','))
      else params.delete(SUBREDDITS_PARAM)
      params.delete('page')
      return params
    })
  }

  return { selected, setSelected }
}

export function TrustedSubredditsSection() {
  const query = useTrustedSubreddits()
  const { selected, setSelected } = useSelectedTrustedSubreddits()

  function toggleSubreddit(name: string) {
    const isSelected = selected.some((s) => s.toLowerCase() === name.toLowerCase())
    setSelected(
      isSelected
        ? selected.filter((s) => s.toLowerCase() !== name.toLowerCase())
        : [...selected, name],
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Trusted subreddits</h2>
          {selected.length > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              Filtering feed by {selected.length} subreddit{selected.length > 1 ? 's' : ''}
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
        <AddTrustedSubredditDialog />
      </div>

      {query.isPending && <Skeleton className="h-8 w-full rounded-full" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && query.data.length === 0 && (
        <EmptyState
          title="No trusted subreddits"
          description="Add communities whose posts should receive source-trust weight."
        />
      )}

      {query.data && query.data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {query.data.map((source) => (
            <SubredditChip
              key={source.name}
              source={source}
              selected={selected.some((s) => s.toLowerCase() === source.name.toLowerCase())}
              onToggleSelected={() => toggleSubreddit(source.name)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
