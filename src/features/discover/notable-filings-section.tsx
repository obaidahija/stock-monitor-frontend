import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
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
import { useNotableFilings } from './hooks'

export function NotableFilingsSection() {
  const { data, isPending, isError, error, refetch } = useNotableFilings()

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Notable filings since previous close</h2>

      {isPending && <Skeleton className="h-40 rounded-xl" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState title="No notable filings" />}

      {data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Form</TableHead>
              <TableHead>Filed</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((filing) => (
              <TableRow key={filing.id}>
                <TableCell className="font-medium">
                  {filing.ticker ? (
                    <Link to={`/stocks/${filing.ticker}`} className="hover:underline">
                      {filing.ticker}
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Badge>{filing.form_type}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(filing.filed_at)}
                </TableCell>
                <TableCell>
                  <a href={filing.filing_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="text-muted-foreground size-4 hover:text-foreground" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
