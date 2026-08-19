import { useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { useAuthorMutations, useTrustedAuthors } from './hooks'

const USER_RE = /^[A-Za-z0-9_-]{3,20}$/

export function TrustedAuthorsSection() {
  const query = useTrustedAuthors()
  const mutations = useAuthorMutations()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = username.trim().toLowerCase()
    if (!USER_RE.test(normalized)) return setError('Use a plain Reddit username (3–20 characters).')
    setError(null)
    mutations.add.mutate(normalized, { onSuccess: () => setUsername('') })
  }
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Trusted authors</h2>
      <form className="flex gap-2" onSubmit={submit}>
        <Input aria-label="Reddit username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" />
        <Button size="sm" type="submit"><Plus /> Add</Button>
      </form>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && <EmptyState title="No trusted authors" description="Add Reddit authors to collect their posts without requesting comment history." />}
      <div className="space-y-2">
        {query.data?.map((source) => (
          <Card key={source.username}><CardContent className="flex items-center justify-between gap-3 py-3">
            <div><p className="text-sm font-medium">u/{source.username}</p><p className="text-muted-foreground text-xs">{source.operation?.status ?? 'idle'}</p></div>
            <div className="flex gap-1">
              <Button size="icon-sm" variant="ghost" aria-label={`Fetch u/${source.username}`} onClick={() => mutations.fetch.mutate(source.username)}><RefreshCw /></Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove u/${source.username}`} onClick={() => mutations.remove.mutate(source.username)}><Trash2 /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </section>
  )
}
