import { Card, CardContent } from '@/components/ui/card'
import type { CompetitorOut } from '@/types/api'

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

export function CompetitorsSummary({ competitors }: { competitors: CompetitorOut[] }) {
  if (competitors.length === 0) return null

  const mutualCount = competitors.filter((c) => c.mutual_naming === true).length
  const highImpactCount = competitors.filter((c) => c.impact_likelihood === 'high').length
  const coreBusinessCount = competitors.filter(
    (c) => c.revenue_dependence?.is_core_business === true,
  ).length

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Competitors found" value={competitors.length} />
      <StatTile label="Mutual naming" value={mutualCount} />
      <StatTile label="High impact" value={highImpactCount} />
      <StatTile label="Core business overlap" value={coreBusinessCount} />
    </div>
  )
}
