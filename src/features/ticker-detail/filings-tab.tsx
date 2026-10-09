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
import { formatTimestamp } from '@/lib/format'
import { formatItemCodes, formToLabel, isFormNameOnly } from '@/lib/labels'
import type { FilingOut } from '@/types/api'
import { useFilings } from './hooks'

/** What a filing is about: 8-K items in words, else its title unless the title only repeats the form. */
function filingDetail(filing: FilingOut): string {
  const items = formatItemCodes(filing.item_codes)
  if (items) return items
  if (!filing.title || isFormNameOnly(filing.title, filing.form_type)) return '—'
  return filing.title
}

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
          <TableHead>Details</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((filing) => (
          <TableRow key={filing.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Badge variant={filing.is_notable ? 'default' : 'outline'}>{filing.form_type}</Badge>
                {formToLabel(filing.form_type) && (
                  <span className="text-muted-foreground text-xs">{formToLabel(filing.form_type)}</span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{formatTimestamp(filing.filed_at)}</TableCell>
            <TableCell className="max-w-80 truncate">{filingDetail(filing)}</TableCell>
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
