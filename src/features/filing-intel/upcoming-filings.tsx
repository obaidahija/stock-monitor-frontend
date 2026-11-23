import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { formatEasternDate, formatEasternTime } from '@/lib/format'
import type { ExpectedFilingOut } from '@/types/filing-intel'
import { useUpcomingFilings } from './hooks'
import {
  BASIS_EXPLANATION,
  BASIS_LABEL,
  CONFIDENCE_CLASS,
  COVERAGE_HINT,
  COVERAGE_LABEL,
  STATUS_CLASS,
} from './labels'

const FORMS = [undefined, '8-K 2.02', '10-Q', '10-K'] as const

function windowText(row: ExpectedFilingOut) {
  const sameDay = formatEasternDate(row.window_start) === formatEasternDate(row.window_end)
  const end = sameDay ? formatEasternTime(row.window_end) : `${formatEasternDate(row.window_end)} ${formatEasternTime(row.window_end)}`
  return `${formatEasternTime(row.window_start).replace(' ET', '')} – ${end}`
}

function historyNote(row: ExpectedFilingOut): string | null {
  const lags = row.detail?.lags as number[] | undefined
  if (lags?.length) return `Past lags after results: ${lags.join(', ')} days`
  const slot = row.detail?.history_slot as string | undefined
  if (slot) return `Usually files ${slot === 'amc' ? 'after the close' : slot === 'bmo' ? 'before the open' : 'at mixed times'}`
  const note = row.detail?.note as string | undefined
  return note ?? null
}

export function UpcomingFilings({ onOpenFiling }: { onOpenFiling: (accession: string) => void }) {
  const [days, setDays] = useState(7)
  const [form, setForm] = useState<string | undefined>(undefined)
  const query = useUpcomingFilings(days, form)

  const rows = query.data ?? []
  const byDay = new Map<string, ExpectedFilingOut[]>()
  for (const row of rows) {
    const list = byDay.get(row.expected_date) ?? []
    list.push(row)
    byDay.set(row.expected_date, list)
  }
  const counts = {
    expected: rows.filter((r) => r.status === 'expected').length,
    filed: rows.filter((r) => r.status === 'filed').length,
    late: rows.filter((r) => r.status === 'late').length,
  }

  return (
    <section className="space-y-4" aria-label="Upcoming filings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {counts.expected} expected · {counts.filed} already filed · {counts.late} late
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Form">
            {FORMS.map((value) => (
              <Button key={value ?? 'all'} size="sm" variant={form === value ? 'default' : 'outline'} onClick={() => setForm(value)}>
                {value ?? 'All forms'}
              </Button>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Horizon">
            {[7, 14].map((value) => (
              <Button key={value} size="sm" variant={days === value ? 'default' : 'outline'} onClick={() => setDays(value)}>
                {value} days
              </Button>
            ))}
          </div>
        </div>
      </div>

      {query.isPending && <Skeleton className="h-64 w-full" />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.isSuccess && rows.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="No filings expected in this window"
          description="The calendar is rebuilt daily at 05:00 ET from earnings dates and each issuer's filing history."
        />
      )}

      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="border-border bg-card overflow-x-auto rounded-lg border">
          <div className="border-border flex items-center justify-between border-b px-4 py-2">
            <h3 className="text-sm font-semibold">{formatEasternDate(`${day}T12:00:00Z`)}</h3>
            <span className="text-muted-foreground text-xs">{list.length} filings</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Window (ET)</TableHead>
                <TableHead>Why expected</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={`${row.ticker}-${row.form}-${row.expected_date}`}>
                  <TableCell>
                    <Link to={`/stocks/${encodeURIComponent(row.ticker)}`} className="font-semibold hover:underline">
                      {row.ticker}
                    </Link>
                    {row.coverage === 'extended' && (
                      <Badge variant="secondary" className="ml-2" title={COVERAGE_HINT}>
                        {COVERAGE_LABEL.extended}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.form === '8-K 2.02' ? '8-K earnings' : row.form}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{windowText(row)}</TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger className="text-left underline decoration-dotted underline-offset-2">
                        {BASIS_LABEL[row.basis]}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{BASIS_EXPLANATION[row.basis]}</p>
                        {historyNote(row) && <p className="mt-1 opacity-80">{historyNote(row)}</p>}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge className={CONFIDENCE_CLASS[row.confidence]}>{row.confidence}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.status === 'filed' && row.matched_accession ? (
                      <button type="button" onClick={() => onOpenFiling(row.matched_accession as string)}>
                        <Badge className={STATUS_CLASS.filed}>filed · view analysis</Badge>
                      </button>
                    ) : (
                      <Badge className={STATUS_CLASS[row.status]}>{row.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </section>
  )
}
