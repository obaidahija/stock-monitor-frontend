import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'
import type { ShortInterestOut } from '@/types/api'

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm tabular-nums">{value ?? '—'}</span>
    </div>
  )
}

/** Displayed data only. Deliberately not scored and deliberately not framed
 * as a squeeze setup: high short interest is ambiguous — squeeze fuel or
 * justified pessimism — so the card states the numbers and stops there. */
export function ShortInterestCard({
  shortInterest,
}: {
  shortInterest: ShortInterestOut | null
}) {
  if (!shortInterest) return null

  const pct = (value: number | null) => (value === null ? null : `${value.toFixed(1)}%`)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Short interest &amp; ownership</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label="Short % of float" value={pct(shortInterest.short_percent_of_float)} />
        <Row
          label="Short ratio"
          value={
            shortInterest.short_ratio === null
              ? null
              : `${shortInterest.short_ratio.toFixed(1)} days`
          }
        />
        <Row
          label="Float"
          value={
            shortInterest.float_shares === null
              ? null
              : `${formatNumber(shortInterest.float_shares)} shares`
          }
        />
        <Row
          label="Institutional ownership"
          value={pct(shortInterest.held_percent_institutions)}
        />
        <Row label="Insider ownership" value={pct(shortInterest.held_percent_insiders)} />
      </CardContent>
    </Card>
  )
}
