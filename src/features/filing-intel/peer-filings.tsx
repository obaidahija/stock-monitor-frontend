import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEasternDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useFilingPeers } from './hooks'
import { DIRECTION_CLASS, KIND_CLASS, KIND_LABEL } from './labels'
import { formatMarketCap } from './market-cap'
import { changeClass } from './price-steps'

function signed(value: number | null | undefined, unit = '%'): string {
  return value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}${unit}`
}

/**
 * Same-industry filings (SEC SIC code, widened to its major group when thin) from the 30 days
 * before this one: how the industry's news was read and how its stocks moved the next day.
 */
export function PeerFilings({ accession, onOpen }: { accession: string; onOpen: (accession: string) => void }) {
  const query = useFilingPeers(accession)
  if (query.isPending) return <Skeleton className="h-24 w-full" />
  const data = query.data
  if (!data?.basis || !data.summary || data.filings.length === 0) {
    return <p className="text-muted-foreground text-sm">No filings from the same industry in the 30 days before this one.</p>
  }
  const { summary, basis } = data
  const positive = summary.positive_share
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-medium">{basis.name ?? `SIC ${basis.code}`}</span>
        <span className="text-muted-foreground">
          {basis.level === 'group' ? ' (industry group)' : ` (SIC ${basis.code})`} · {summary.count} filings from{' '}
          {summary.tickers} companies in the 30 days before
        </span>
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {positive !== null && (
          <Badge variant="outline" title="Share of the labelled peer filings read positive">
            {Math.round(positive * 100)}% positive
          </Badge>
        )}
        <Badge variant="outline" title="Average next-day move from each peer's price at filing">
          next day <span className={cn('ml-1 font-semibold', changeClass(summary.mean_move_1d_pct))}>{signed(summary.mean_move_1d_pct)}</span>
        </Badge>
        <Badge variant="outline" title="Average next-day move minus SPY's (from the last close before each filing)">
          vs SPY <span className={cn('ml-1 font-semibold', changeClass(summary.mean_excess_1d))}>{signed(summary.mean_excess_1d, ' pts')}</span>
        </Badge>
      </div>
      <ul className="divide-border border-border divide-y rounded-md border">
        {data.filings.map((peer) => (
          <li key={peer.accession}>
            <button
              type="button"
              onClick={() => onOpen(peer.accession)}
              className="hover:bg-muted/50 flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left text-sm"
            >
              <span className="font-semibold">{peer.ticker}</span>
              {peer.market_cap ? <span className="text-muted-foreground text-xs">{formatMarketCap(peer.market_cap)}</span> : null}
              {peer.kind && <Badge className={KIND_CLASS[peer.kind]}>{KIND_LABEL[peer.kind]}</Badge>}
              {peer.label && (
                <Badge className={cn(DIRECTION_CLASS[peer.label])}>
                  {peer.label}
                  {peer.strength === 'strong' ? ' · strong' : ''}
                </Badge>
              )}
              <span className="text-muted-foreground text-xs">{formatEasternDateTime(peer.accepted_at)}</span>
              <span className={cn('ml-auto font-semibold tabular-nums', changeClass(peer.move_1d_pct))} title="Next-day move from its price at filing">
                {signed(peer.move_1d_pct)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
