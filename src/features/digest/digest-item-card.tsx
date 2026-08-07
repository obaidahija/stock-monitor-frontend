import { Link } from 'react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TierBadge } from '@/components/shared/tier-badge'
import { SentimentBadge } from '@/components/shared/sentiment-badge'
import { formatCurrency, formatSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DigestItem } from '@/types/api'

export function DigestItemCard({ item }: { item: DigestItem }) {
  const changePct = item.premarket?.change_pct ?? null

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
            <TierBadge tier={item.tier} />
            {item.sentiment && (
              <SentimentBadge label={item.sentiment.label} score={item.sentiment.net_score} />
            )}
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
