import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { WatchlistEventInput } from '@/api/watchlists'
import { Badge } from '@/components/ui/badge'
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
import { formatCurrency, formatEasternDateTime } from '@/lib/format'
import type {
  WatchlistEventComparison,
  WatchlistEventOut,
  WatchlistItemOut,
  WatchlistSetupLevel,
} from '@/types/api'
import {
  useCreateWatchlistEvent,
  useDeleteWatchlistEvent,
  useRearmWatchlistEvent,
  useRetryWatchlistEventDelivery,
  useSendTelegramTest,
  useTelegramStatus,
  useUpdateWatchlistEvent,
  useWatchlistEvents,
} from './hooks'

const LEVEL_LABELS: Record<WatchlistSetupLevel, string> = {
  entry_primary: 'Primary entry',
  entry_secondary: 'Secondary entry',
  stop_loss: 'Stop loss',
  take_profit: 'Take profit',
}

export function WatchlistEventsDialog({ item }: { item: WatchlistItemOut }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WatchlistEventOut | null>(null)
  const [comparison, setComparison] = useState<WatchlistEventComparison>('lte')
  const [threshold, setThreshold] = useState('')
  const [message, setMessage] = useState('')
  const [sourceLevel, setSourceLevel] = useState<WatchlistSetupLevel | null>(null)
  const events = useWatchlistEvents(item.id, open)
  const telegram = useTelegramStatus(open)
  const create = useCreateWatchlistEvent()
  const update = useUpdateWatchlistEvent()
  const rearm = useRearmWatchlistEvent()
  const remove = useDeleteWatchlistEvent()
  const retry = useRetryWatchlistEventDelivery()
  const sendTest = useSendTelegramTest()
  const isSaving = create.isPending || update.isPending || rearm.isPending

  const effectivePrice =
    item.market_session === 'pre_market' ||
    item.market_session === 'post_market' ||
    item.market_session === 'overnight'
      ? item.session_price
      : item.current_price
  const numericThreshold = Number(threshold)
  const alreadyMet =
    effectivePrice !== null &&
    numericThreshold > 0 &&
    (comparison === 'lte'
      ? effectivePrice <= numericThreshold
      : effectivePrice >= numericThreshold)

  function resetForm() {
    setEditing(null)
    setComparison('lte')
    setThreshold('')
    setMessage('')
    setSourceLevel(null)
  }

  useEffect(() => {
    if (!open) resetForm()
  }, [open])

  const setupLevels = useMemo(() => {
    const setup = item.current_setup
    if (!setup || setup.status !== 'active') return []
    return (Object.keys(LEVEL_LABELS) as WatchlistSetupLevel[])
      .map((level) => ({ level, value: setup[level] }))
      .filter((entry): entry is { level: WatchlistSetupLevel; value: number } =>
        typeof entry.value === 'number',
      )
  }, [item.current_setup])

  function selectSetupLevel(level: WatchlistSetupLevel, value: number) {
    const setup = item.current_setup
    if (!setup) return
    const nextComparison =
      level === 'take_profit'
        ? setup.side === 'long' ? 'gte' : 'lte'
        : setup.side === 'long' ? 'lte' : 'gte'
    setComparison(nextComparison)
    setThreshold(String(value))
    setSourceLevel(level)
  }

  function editEvent(event: WatchlistEventOut) {
    setEditing(event)
    setComparison(event.condition.comparison)
    setThreshold(String(event.condition.threshold_price))
    setMessage(event.message ?? '')
    const canKeepSource =
      event.condition.kind === 'setup_level' &&
      event.condition.setup_id === item.current_setup?.id &&
      item.current_setup.status === 'active'
    setSourceLevel(canKeepSource ? event.condition.level : null)
  }

  function buildBody(): WatchlistEventInput {
    const setup = item.current_setup
    return {
      event_type: 'price_threshold',
      condition:
        sourceLevel && setup
          ? { kind: 'setup_level', setup_id: setup.id, level: sourceLevel }
          : {
              kind: 'custom',
              comparison,
              threshold_price: numericThreshold,
            },
      message: message.trim() || undefined,
    }
  }

  async function saveEvent() {
    try {
      const body = buildBody()
      if (!editing) {
        await create.mutateAsync({ itemId: item.id, body })
        toast.success(`${item.ticker} event created`)
      } else if (editing.state === 'active') {
        await update.mutateAsync({ id: editing.id, body })
        toast.success(`${item.ticker} event updated`)
      } else {
        await rearm.mutateAsync({ id: editing.id, body })
        toast.success(`${item.ticker} event re-armed`)
      }
      resetForm()
    } catch {
      toast.error('Could not save this price event')
    }
  }

  async function deleteEvent(event: WatchlistEventOut) {
    if (!window.confirm(`Delete this ${item.ticker} price event?`)) return
    try {
      await remove.mutateAsync(event.id)
      if (editing?.id === event.id) resetForm()
      toast.success('Price event deleted')
    } catch {
      toast.error('Could not delete this price event')
    }
  }

  async function retryDelivery(event: WatchlistEventOut) {
    try {
      await retry.mutateAsync(event.id)
      toast.success('Telegram delivery queued again')
    } catch {
      toast.error('Could not retry Telegram delivery')
    }
  }

  async function testTelegram() {
    try {
      await sendTest.mutateAsync()
      toast.success('Telegram test message sent')
    } catch {
      toast.error('Telegram test failed')
    }
  }

  const formComplete = numericThreshold > 0 && telegram.data?.ready === true

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Manage ${item.ticker} price events`}
          title={`Manage ${item.ticker} price events`}
        >
          <Bell />
          {item.active_event_count > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-[10px] leading-4">
              {item.active_event_count}
            </span>
          )}
          {item.has_event_delivery_failure && (
            <span className="bg-destructive absolute right-0 bottom-0 size-2 rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item.ticker} price events</DialogTitle>
          <DialogDescription>
            Send one Telegram message when a live watchlist quote meets a condition.
          </DialogDescription>
        </DialogHeader>

        <TelegramState
          pending={telegram.isPending}
          configured={telegram.data?.configured ?? false}
          ready={telegram.data?.ready ?? false}
          error={telegram.data?.error}
          testing={sendTest.isPending}
          onTest={() => void testTelegram()}
        />

        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">
              {editing
                ? editing.state === 'active' ? 'Edit event' : 'Edit and re-arm'
                : 'New price event'}
            </h3>
            {editing && <Button variant="ghost" size="sm" onClick={resetForm}>New event</Button>}
          </div>

          {setupLevels.length > 0 && (
            <div className="space-y-1.5">
              <Label>Use setup level</Label>
              <div className="flex flex-wrap gap-2">
                {setupLevels.map(({ level, value }) => (
                  <Button
                    key={level}
                    type="button"
                    size="sm"
                    variant={sourceLevel === level ? 'secondary' : 'outline'}
                    onClick={() => selectSetupLevel(level, value)}
                  >
                    {LEVEL_LABELS[level]} · {formatCurrency(value)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr]">
            <div className="space-y-1.5">
              <Label htmlFor={`event-comparison-${item.id}`}>Condition</Label>
              <select
                id={`event-comparison-${item.id}`}
                value={comparison}
                onChange={(event) => {
                  setComparison(event.target.value as WatchlistEventComparison)
                  setSourceLevel(null)
                }}
                className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
              >
                <option value="lte">Price ≤ target</option>
                <option value="gte">Price ≥ target</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`event-price-${item.id}`}>Target price</Label>
              <Input
                id={`event-price-${item.id}`}
                type="number"
                min="0"
                step="any"
                value={threshold}
                onChange={(event) => {
                  setThreshold(event.target.value)
                  setSourceLevel(null)
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`event-message-${item.id}`}>Message</Label>
            <textarea
              id={`event-message-${item.id}`}
              value={message}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              className="border-input bg-background min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-sm"
              placeholder="Optional note to include before the quote details"
            />
          </div>

          <p className="text-muted-foreground text-xs">
            Current effective price: {formatCurrency(effectivePrice)}. Events trigger only on
            fresh pre-market, regular, or post-market quotes.
          </p>
          {alreadyMet && (
            <p className="text-amber-600 flex items-start gap-2 text-sm dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              This condition is already true and will trigger on the next valid quote evaluation.
            </p>
          )}
          <div className="flex justify-end">
            <Button disabled={!formComplete || isSaving} onClick={() => void saveEvent()}>
              {isSaving && <Loader2 className="animate-spin" />}
              {editing && editing.state !== 'active' ? 'Save and re-arm' : 'Save event'}
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Saved events</h3>
          {events.isPending && <p className="text-muted-foreground text-sm">Loading events…</p>}
          {events.data?.length === 0 && (
            <p className="text-muted-foreground rounded-lg border p-3 text-sm">
              No price events have been defined for this watchlist item.
            </p>
          )}
          {events.data?.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onEdit={() => editEvent(event)}
              onDelete={() => void deleteEvent(event)}
              onRetry={() => void retryDelivery(event)}
            />
          ))}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TelegramState({
  pending,
  configured,
  ready,
  error,
  testing,
  onTest,
}: {
  pending: boolean
  configured: boolean
  ready: boolean
  error?: string | null
  testing: boolean
  onTest: () => void
}) {
  if (pending) return <p className="text-muted-foreground text-sm">Checking Telegram…</p>
  return (
    <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
      {ready ? (
        <><CheckCircle2 className="size-4 text-emerald-500" /><span>Telegram is ready.</span></>
      ) : (
        <>
          <AlertTriangle className="text-destructive size-4" />
          <span>{error || 'Telegram is not ready.'}</span>
          {!configured && (
            <code className="text-xs">Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.</code>
          )}
        </>
      )}
      {configured && (
        <Button className="ml-auto" size="sm" variant="outline" disabled={testing} onClick={onTest}>
          {testing ? <Loader2 className="animate-spin" /> : <Send />} Test message
        </Button>
      )}
    </div>
  )
}

function EventRow({
  event,
  onEdit,
  onDelete,
  onRetry,
}: {
  event: WatchlistEventOut
  onEdit: () => void
  onDelete: () => void
  onRetry: () => void
}) {
  const occurrence = event.last_occurrence
  const operator = event.condition.comparison === 'lte' ? '≤' : '≥'
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Price {operator} {formatCurrency(event.condition.threshold_price)}</span>
            <Badge variant={event.state === 'active' ? 'secondary' : 'outline'} className="capitalize">
              {event.state}
            </Badge>
            {occurrence && <DeliveryBadge status={occurrence.delivery_status} />}
          </div>
          {event.condition.level && (
            <p className="text-muted-foreground mt-1 text-xs">
              From {LEVEL_LABELS[event.condition.level]}
            </p>
          )}
          {event.message && <p className="mt-1 text-sm whitespace-pre-wrap break-words">{event.message}</p>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={event.state === 'active' ? 'Edit event' : 'Edit and re-arm event'} onClick={onEdit}>
            {event.state === 'active' ? <Pencil /> : <RotateCcw />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete event" onClick={onDelete}><Trash2 /></Button>
        </div>
      </div>
      {event.disabled_reason && <p className="text-muted-foreground text-xs">{event.disabled_reason}</p>}
      {occurrence && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>Observed {formatCurrency(occurrence.observed_price)}</span>
          <span>{formatEasternDateTime(occurrence.quote_at)}</span>
          {occurrence.sent_at && <span>Sent {formatEasternDateTime(occurrence.sent_at)}</span>}
          {occurrence.delivery_status === 'failed' && (
            <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw /> Retry delivery</Button>
          )}
        </div>
      )}
      {occurrence?.last_error && occurrence.delivery_status === 'failed' && (
        <p className="text-destructive text-xs">{occurrence.last_error}</p>
      )}
    </div>
  )
}

function DeliveryBadge({ status }: { status: NonNullable<WatchlistEventOut['last_occurrence']>['delivery_status'] }) {
  return (
    <Badge variant={status === 'failed' ? 'destructive' : 'outline'} className="capitalize">
      {status === 'retrying' ? 'Delivery retrying' : status === 'sent' ? 'Sent' : status}
    </Badge>
  )
}
