import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { captureSetupRevision } from '@/api/watchlists'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useResearchCapabilities } from '@/features/research/hooks'
import { ApiError } from '@/lib/api-client'
import type { FollowThroughCreate, WatchlistSetupOut } from '@/types/api'
import {
  useActivateFollowThrough, useFollowThroughDetail, useFollowThroughTracks,
  useStopFollowThrough,
} from './follow-through-hooks'
import { FollowThroughTimeline } from './follow-through-timeline'

type Origin = { kind: 'setup'; setup: WatchlistSetupOut } | { kind: 'catalyst'; candidateId: number }

export function FollowThroughControl({
  ticker, origin, enabled,
}: { ticker: string; origin: Origin; enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [horizon, setHorizon] = useState(5)
  const queryClient = useQueryClient()
  const requestKey = useRef<string | null>(null)
  const list = useFollowThroughTracks(ticker, open, page)
  const detail = useFollowThroughDetail(open ? selectedId : null)
  const activate = useActivateFollowThrough()
  const stop = useStopFollowThrough()
  const capabilities = useResearchCapabilities()
  const activeOrigin = list.data?.items.find((track) =>
    track.lifecycle === 'active' && (origin.kind === 'setup'
      ? track.setup_id === origin.setup.id
      : track.source_candidate_id === origin.candidateId))

  async function start() {
    requestKey.current ??= crypto.randomUUID()
    try {
      let body: FollowThroughCreate
      if (origin.kind === 'setup') {
        const revisionId = origin.setup.current_revision_id ??
          (await captureSetupRevision(origin.setup.id)).current_revision_id
        body = { origin: 'setup', setup_revision_id: revisionId }
      } else {
        body = { origin: 'catalyst', candidate_id: origin.candidateId, horizon_sessions: horizon }
      }
      const track = await activate.mutateAsync({ body, key: requestKey.current })
      requestKey.current = null
      setSelectedId(track.id)
      toast.success('Follow-through tracking started')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        requestKey.current = null
        void queryClient.invalidateQueries({ queryKey: ['watchlists'] })
        void queryClient.invalidateQueries({ queryKey: ['follow-through', 'ticker', ticker] })
        toast.error('The source changed. Refresh it before tracking these levels.')
      } else {
        toast.error('Could not start tracking. Retry to reuse the same request.')
      }
    }
  }

  async function stopSelected() {
    if (selectedId === null) return
    try {
      await stop.mutateAsync(selectedId)
      toast.success('Tracking stopped; history remains available')
    } catch {
      toast.error('Could not stop tracking')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Follow-through</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ticker} follow-through</DialogTitle>
          <DialogDescription>
            Explicit research tracking from the first future close. No entry or fill is inferred.
          </DialogDescription>
        </DialogHeader>
        {enabled && !activeOrigin && (
          <div className="flex flex-wrap items-center gap-2">
            {origin.kind === 'catalyst' && (
              <label className="text-sm">Window{' '}
                <select aria-label="Tracking window" value={horizon}
                  onChange={(event) => setHorizon(Number(event.target.value))}
                  className="border-input bg-background rounded-md border p-1">
                  {[1, 3, 5, 7].map((value) => <option key={value} value={value}>{value} sessions</option>)}
                </select>
              </label>
            )}
            <Button size="sm" disabled={activate.isPending} onClick={() => void start()}>
              {activate.isPending ? 'Starting…' : 'Track follow-through'}
            </Button>
          </div>
        )}
        {!enabled && <p className="text-muted-foreground text-xs">New tracking is off. Recorded history remains available.</p>}
        {activeOrigin && <Button variant="secondary" size="sm" onClick={() => setSelectedId(activeOrigin.id)}>View active timeline</Button>}
        <div className="space-y-2">
          <p className="text-sm font-medium">Recorded tracks</p>
          {list.isPending && <p className="text-muted-foreground text-xs">Loading history…</p>}
          {list.isError && <Button variant="ghost" size="sm" onClick={() => void list.refetch()}>Retry history</Button>}
          {list.data?.items.length === 0 && <p className="text-muted-foreground text-xs">No tracks recorded for this ticker.</p>}
          {list.data?.items.map((track) => (
            <Button key={track.id} variant={selectedId === track.id ? 'secondary' : 'ghost'}
              size="sm" onClick={() => setSelectedId(track.id)}>
              #{track.id} {track.origin} · {track.lifecycle} · {track.baseline_session}
            </Button>
          ))}
          {(list.data?.total ?? 0) > 100 && (
            <div className="flex gap-2 text-xs">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page * 100 >= (list.data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
        {detail.isPending && selectedId !== null && <p className="text-muted-foreground text-xs">Loading timeline…</p>}
        {detail.isError && <Button variant="ghost" size="sm" onClick={() => void detail.refetch()}>Retry timeline</Button>}
        {detail.data && (
          <div className="space-y-3 border-t pt-3">
            <FollowThroughTimeline detail={detail.data} intradayEnabled={capabilities.data?.research_intraday_enabled === true} />
            {enabled && detail.data.track.lifecycle === 'active' && (
              <Button variant="outline" size="sm" disabled={stop.isPending} onClick={() => void stopSelected()}>Stop tracking</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
