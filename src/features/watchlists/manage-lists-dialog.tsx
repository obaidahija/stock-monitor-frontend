import { BookmarkPlus, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useAddWatchlistItem,
  useCreateWatchlist,
  useRemoveWatchlistItem,
  useWatchlists,
} from './hooks'

export function ManageListsDialog({
  ticker,
  labeled = false,
}: {
  ticker: string
  labeled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [newName, setNewName] = useState('')
  const lists = useWatchlists(ticker)
  const addItem = useAddWatchlistItem()
  const removeItem = useRemoveWatchlistItem()
  const createList = useCreateWatchlist()
  const isSaving = addItem.isPending || removeItem.isPending

  useEffect(() => {
    if (open && lists.data) {
      setSelected(new Set(lists.data.filter((list) => list.contains_ticker).map((list) => list.id)))
    }
  }, [open, lists.data])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    try {
      const created = await createList.mutateAsync(name)
      setNewName('')
      setSelected((current) => new Set(current).add(created.id))
    } catch {
      toast.error('Could not create the watchlist')
    }
  }

  async function handleSave() {
    if (!lists.data) return
    const additions = lists.data.filter((list) => selected.has(list.id) && !list.contains_ticker)
    const removals = lists.data.filter((list) => !selected.has(list.id) && list.contains_ticker)
    const protectedRemovals = removals.filter((list) => list.has_setup)
    if (
      protectedRemovals.length > 0 &&
      !window.confirm(
        `Removing ${ticker} from ${protectedRemovals.map((list) => list.name).join(', ')} will also delete its setup history. Continue?`,
      )
    ) {
      return
    }
    try {
      await Promise.all([
        ...additions.map((list) => addItem.mutateAsync({ watchlistId: list.id, ticker })),
        ...removals.map((list) => removeItem.mutateAsync({ watchlistId: list.id, ticker })),
      ])
      toast.success(`${ticker} watchlists updated`)
      setOpen(false)
    } catch {
      toast.error(`Could not update watchlists for ${ticker}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {labeled ? (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Manage ${ticker} watchlists`}
            className="cursor-pointer"
          >
            <BookmarkPlus />
            Manage lists
          </Button>
        </DialogTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Manage ${ticker} watchlists`}
                className="cursor-pointer"
              >
                <BookmarkPlus />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Add to watchlist</TooltipContent>
        </Tooltip>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {ticker} to watchlists</DialogTitle>
          <DialogDescription>
            Membership is separate from tracked-universe coverage. Select every list where this ticker belongs.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {lists.isPending && <Loader2 className="mx-auto animate-spin" />}
          {lists.data?.map((list) => (
            <label key={list.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                checked={selected.has(list.id)}
                onChange={(event) => {
                  setSelected((current) => {
                    const next = new Set(current)
                    if (event.target.checked) next.add(list.id)
                    else next.delete(list.id)
                    return next
                  })
                }}
              />
              <span className="flex-1 font-medium">{list.name}</span>
              <span className="text-muted-foreground text-xs">
                {list.has_setup ? 'Has setup' : `${list.item_count} ticker${list.item_count === 1 ? '' : 's'}`}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New list name"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleCreate()
              }
            }}
          />
          <Button variant="outline" onClick={() => void handleCreate()} disabled={!newName.trim() || createList.isPending}>
            <Plus />
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={isSaving || lists.isPending}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
