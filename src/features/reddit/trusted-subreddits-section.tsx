import { useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { useSubredditMutations, useTrustedSubreddits } from './hooks'

const NAME_RE = /^[A-Za-z0-9_]{2,21}$/

export function TrustedSubredditsSection() {
  const query = useTrustedSubreddits()
  const mutations = useSubredditMutations()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = name.trim().toLowerCase()
    if (!NAME_RE.test(normalized)) return setError('Use a plain subreddit name (2–21 characters).')
    setError(null)
    mutations.add.mutate({ name: normalized, sort: 'new' }, { onSuccess: () => setName('') })
  }
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Trusted subreddits</h2>
      <form className="flex gap-2" onSubmit={submit}>
        <Input aria-label="Subreddit name" value={name} onChange={(event) => setName(event.target.value)} placeholder="wallstreetbets" />
        <Button size="sm" type="submit"><Plus /> Add</Button>
      </form>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && <EmptyState title="No trusted subreddits" description="Add communities whose posts should receive source-trust weight." />}
      <div className="space-y-2">
        {query.data?.map((source) => (
          <Card key={source.name}><CardContent className="flex items-center justify-between gap-3 py-3">
            <div><p className="text-sm font-medium">r/{source.name}</p><p className="text-muted-foreground text-xs">Default: {source.default_sort} · {source.operation?.status ?? 'idle'}</p></div>
            <div className="flex gap-1">
              <Button size="icon-sm" variant="ghost" aria-label={`Fetch r/${source.name}`} onClick={() => mutations.fetch.mutate({ name: source.name, sort: source.default_sort })}><RefreshCw /></Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove r/${source.name}`} onClick={() => mutations.remove.mutate(source.name)}><Trash2 /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </section>
  )
}
