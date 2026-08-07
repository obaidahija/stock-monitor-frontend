import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { formatDateTime } from '@/lib/format'
import { useFilings } from './hooks'

export function FilingsTab({ ticker }: { ticker: string }) {
  const { data, isPending, isError, error, refetch } = useFilings(ticker)

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data || data.length === 0) return <EmptyState title="No recent filings" />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Form</TableHead>
          <TableHead>Filed</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((filing) => (
          <TableRow key={filing.id}>
            <TableCell>
              <Badge variant={filing.is_notable ? 'default' : 'outline'}>{filing.form_type}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDateTime(filing.filed_at)}</TableCell>
            <TableCell className="max-w-80 truncate">{filing.title ?? '—'}</TableCell>
            <TableCell>
              <a href={filing.filing_url} target="_blank" rel="noreferrer">
                <ExternalLink className="text-muted-foreground size-4 hover:text-foreground" />
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
