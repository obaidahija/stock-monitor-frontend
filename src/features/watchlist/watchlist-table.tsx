import { Link } from 'react-router'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { useRemoveFromWatchlist } from './hooks'
import type { WatchlistItem } from '@/types/api'

export function WatchlistTable({ items }: { items: WatchlistItem[] }) {
  const removeFromWatchlist = useRemoveFromWatchlist()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticker</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Note</TableHead>
          <TableHead>Added</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">
              <Link to={`/stocks/${item.ticker}`} className="hover:underline">
                {item.ticker}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{item.company_name ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground max-w-60 truncate">
              {item.note ?? '—'}
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDate(item.added_at)}</TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.ticker}`}
                onClick={() =>
                  removeFromWatchlist.mutate(item.ticker, {
                    onSuccess: () => toast.success(`${item.ticker} removed`),
                    onError: () => toast.error(`Failed to remove ${item.ticker}`),
                  })
                }
              >
                <Trash2 />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
