import { useState } from 'react'
import { EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatEasternDateTime } from '@/lib/format'
import { useDigestDismissals, useRestoreDigestItem } from './hooks'

export function HiddenDigestTickers() {
  const [open, setOpen] = useState(false)
  const query = useDigestDismissals(open)
  const restore = useRestoreDigestItem()
  async function restoreTicker(ticker: string) {
    try {
      await restore.mutateAsync(ticker)
      toast.success(`${ticker} restored to digest coverage`)
    } catch { toast.error(`Could not restore ${ticker}`) }
  }
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button variant="ghost" size="sm"><EyeOff data-icon="inline-start" />Hidden tickers</Button></SheetTrigger>
    <SheetContent>
      <SheetHeader><SheetTitle>Hidden tickers</SheetTitle>
        <SheetDescription>Tickers stay hidden for seven days. Restore one to include it in available editions and future coverage.</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        {query.isPending && <div role="status"><span className="sr-only">Loading hidden tickers</span><Skeleton className="h-16 w-full" /></div>}
        {query.isError && <Alert variant="destructive"><AlertTitle>Could not load hidden tickers</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
        </Alert>}
        {query.data?.length === 0 && <p className="text-muted-foreground text-sm">No hidden tickers.</p>}
        {query.data && query.data.length > 0 && <ul className="flex flex-col gap-3">
          {query.data.map((item) => <li key={item.ticker} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex min-w-0 flex-col gap-1"><span className="font-semibold">{item.ticker}</span>
              <span className="text-muted-foreground text-xs">Hidden until {formatEasternDateTime(item.expires_at)}</span>
            </div>
            <Button variant="outline" size="sm" disabled={restore.isPending}
              aria-label={`Restore ${item.ticker}`} onClick={() => void restoreTicker(item.ticker)}>Restore</Button>
          </li>)}
        </ul>}
      </div>
    </SheetContent>
  </Sheet>
}
