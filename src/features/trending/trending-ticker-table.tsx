import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { REDDIT_DOT, TWITTER_DOT, toneOf } from '@/features/discover/social-buzz'
import { formatCurrency, formatNumber, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TrendingTickerOut } from '@/types/api'
import { blendedTrendingSentiment } from './sentiment'
import { MiniSparkline } from './mini-sparkline'

function ChangeText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
      {formatSignedPct(value)}
    </span>
  )
}

export function TrendingTickerTable({ items }: { items: TrendingTickerOut[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Platforms</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead className="text-right">Days trending</TableHead>
            <TableHead>Trend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const sentimentScore = blendedTrendingSentiment(item)
            return (
              <TableRow key={item.ticker}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link to={`/stocks/${item.ticker}`} className="font-medium hover:underline">
                      {item.ticker}
                    </Link>
                    {item.is_new_entrant && (
                      <Badge variant="secondary" className="text-[10px]">
                        New
                      </Badge>
                    )}
                  </div>
                  {item.company_name && (
                    <div className="text-muted-foreground text-xs">{item.company_name}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {item.sector ?? '—'}
                </TableCell>
                <TableCell className="text-right text-sm whitespace-nowrap">
                  <div>{formatCurrency(item.price)}</div>
                  <ChangeText value={item.change_pct} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-xs whitespace-nowrap">
                    {item.twitter && (
                      <span className="flex items-center gap-1.5">
                        <span className={cn('size-1.5 shrink-0 rounded-full', TWITTER_DOT)} />#
                        {item.twitter.rank} · {formatNumber(item.twitter.unique_authors)} authors
                      </span>
                    )}
                    {item.reddit && (
                      <span className="flex items-center gap-1.5">
                        <span className={cn('size-1.5 shrink-0 rounded-full', REDDIT_DOT)} />#
                        {item.reddit.rank} · {formatNumber(item.reddit.mention_count)} mentions
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <SentimentBadge
                    label={sentimentScore === null ? null : toneOf(sentimentScore)}
                    score={sentimentScore}
                  />
                </TableCell>
                <TableCell className="text-right text-sm">{item.appeared_days}d</TableCell>
                <TableCell>
                  <MiniSparkline points={item.sparkline} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
