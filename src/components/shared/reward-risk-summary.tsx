import {
  calculateRewardRisk,
  type RewardRiskLevels,
  type RewardRiskResult,
  type RewardRiskSide,
} from '@/lib/reward-risk'

const standardNumber = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const smallNumber = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 8,
})

function formatDistance(value: number): string {
  if (value < 1e-8 || value >= 1e9) return value.toExponential(2)
  return (value < 0.01 ? smallNumber : standardNumber).format(value)
}

function unavailableReason(reason: Extract<RewardRiskResult, { status: 'unavailable' }>['reason'], comparison: boolean) {
  switch (reason) {
    case 'missing_prices': return 'Entry, stop and target are required.'
    case 'invalid_prices': return 'Prices must be positive, finite numbers.'
    case 'invalid_order': return 'Stop and target conflict with the setup side.'
    case 'outside_levels': return comparison
      ? 'Price is at or beyond the stop/target references.'
      : 'Entry must be strictly between stop and target.'
    case 'unrepresentable': return 'These price distances cannot be represented reliably.'
  }
}

function EntrySummary({
  label,
  entry,
  result,
  comparison = false,
}: {
  label: string
  entry: number | null | undefined
  result: RewardRiskResult
  comparison?: boolean
}) {
  const price = entry != null && Number.isFinite(entry) && entry > 0
    ? `$${formatDistance(entry)}` : 'Not provided'

  return (
    <div role="group" aria-label={`${label} reward/risk`} className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{price}</span>
      </div>
      {result.status === 'available' ? (
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Distance to stop</dt>
            <dd className="mt-1 break-words tabular-nums">
              <span className="block">${formatDistance(result.stopDistance)}</span>
              <span className="text-muted-foreground">{formatDistance(result.stopDistancePct)}%</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Distance to target</dt>
            <dd className="mt-1 break-words tabular-nums">
              <span className="block">${formatDistance(result.targetDistance)}</span>
              <span className="text-muted-foreground">{formatDistance(result.targetDistancePct)}%</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Reward / risk</dt>
            <dd className="mt-1 break-words font-medium tabular-nums">{formatDistance(result.rewardRisk)} : 1</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground text-xs">Unavailable — {unavailableReason(result.reason, comparison)}</p>
      )}
    </div>
  )
}

export function RewardRiskSummary({
  levels,
  side,
  comparison,
  accessibleLabel = 'Reward/risk',
}: {
  levels: RewardRiskLevels | null
  side?: RewardRiskSide
  comparison?: { label: string; price: number | null }
  accessibleLabel?: string
}) {
  const references = { stop: levels?.stop_loss, target: levels?.take_profit, side }
  const entries = [{ label: 'Primary entry', entry: levels?.entry_primary }]
  if (levels?.entry_secondary != null) {
    entries.push({ label: 'Secondary entry', entry: levels.entry_secondary })
  }

  return (
    <section aria-label={accessibleLabel} className="flex min-w-0 flex-col gap-3">
      <h3 className="text-sm font-medium">Reward / risk</h3>
      {entries.map(({ label, entry }) => (
        <EntrySummary key={label} label={label} entry={entry}
          result={calculateRewardRisk({ ...references, entry })} />
      ))}
      {comparison && (
        <EntrySummary label={comparison.label} entry={comparison.price} comparison
          result={calculateRewardRisk({ ...references, entry: comparison.price })} />
      )}
      <p className="text-muted-foreground text-xs">
        Price distances before costs; not a target probability or a guaranteed loss limit.
      </p>
    </section>
  )
}
