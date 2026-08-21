import { Link } from 'react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { StageBadge } from '@/components/shared/stage-badge'
import { formatCurrency, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DigestItem } from '@/types/api'

export function DigestItemCard({ item }: { item: DigestItem }) {
  const changePct = item.premarket?.change_pct ?? null
  const pattern = item.near_low_pattern

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <Link
            to={`/stocks/${item.ticker}`}
            className="text-lg font-semibold tracking-tight hover:underline"
          >
            {item.ticker}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.sentiment && (
              <SentimentBadge label={item.sentiment.label} score={item.sentiment.net_score} />
            )}
            {item.stages.map((stage) => (
              <StageBadge key={stage} stage={stage} />
            ))}
          </div>
        </div>
        {item.premarket && (
          <div className="text-right">
            <div className="font-medium tabular-nums">{formatCurrency(item.premarket.price)}</div>
            <div
              className={cn(
                'text-sm tabular-nums',
                changePct === null
                  ? 'text-muted-foreground'
                  : changePct >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400',
              )}
            >
              {formatSignedPct(changePct)}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {pattern && (
          <div className="rounded-md border border-teal-500/30 bg-teal-500/5 p-2 text-sm">
            <p className="font-medium text-teal-700 dark:text-teal-300">
              {pattern.label} pattern detected ({(pattern.confidence * 100).toFixed(0)}% confidence)
            </p>
            {item.pct_from_12wk_avg !== null && (
              <p className="text-muted-foreground text-xs">
                {formatSignedPct(item.pct_from_12wk_avg)} vs 12-week average close
              </p>
            )}
          </div>
        )}
        {(item.premarket_gap_pct !== null || item.volume_ratio !== null) && (
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums">
            {item.premarket_gap_pct !== null && (
              <span className="text-sky-600 dark:text-sky-400">
                Premarket {formatSignedPct(item.premarket_gap_pct)}
              </span>
            )}
            {item.volume_ratio !== null && <span>{item.volume_ratio.toFixed(1)}× avg volume</span>}
          </div>
        )}

        {item.reasons.map((reason, i) => (
          <p key={i} className="text-sm">
            {reason}
          </p>
        ))}
        {item.headline_snippets.length > 0 && (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {item.headline_snippets.map((headline, i) => (
              <li key={i} className="truncate">
                · {headline}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
