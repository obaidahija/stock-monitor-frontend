import { TrendingUp, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DriversRisks({
  keyDrivers,
  risks,
}: {
  keyDrivers: string[]
  risks: string[]
}) {
  if (keyDrivers.length === 0 && risks.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-emerald-600 dark:text-emerald-400">Key drivers</CardTitle>
        </CardHeader>
        <CardContent>
          {keyDrivers.length > 0 ? (
            <ul className="space-y-1.5">
              {keyDrivers.map((driver, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {driver}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">None identified.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-amber-600 dark:text-amber-400">Risks</CardTitle>
        </CardHeader>
        <CardContent>
          {risks.length > 0 ? (
            <ul className="space-y-1.5">
              {risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  {risk}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">None identified.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
