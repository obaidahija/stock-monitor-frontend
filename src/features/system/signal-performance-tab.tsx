import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSignalPerformance } from './hooks'

const pct = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`)
const signed = (value: number | null) =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`

export function SignalPerformanceTab() {
  const [horizon, setHorizon] = useState<5 | 20>(5)
  const { data, isLoading } = useSignalPerformance(horizon)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          How this app&apos;s own score has actually performed, measured against the average
          tracked name over the same window. Descriptive only — no weight is adjusted
          automatically.
        </p>
        <Tabs value={String(horizon)} onValueChange={(v) => setHorizon(Number(v) as 5 | 20)}>
          <TabsList>
            <TabsTrigger value="5">5 days</TabsTrigger>
            <TabsTrigger value="20">20 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading || !data || data.evaluated_count === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-sm">
              {isLoading
                ? 'Loading…'
                : `No outcomes have matured yet at this horizon. Snapshots are taken daily and become measurable ${horizon} trading days later.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                By lean · {data.evaluated_count} evaluated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lean</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Hit rate</TableHead>
                    <TableHead className="text-right">Avg excess</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_lean.map((row) => (
                    <TableRow key={row.lean}>
                      <TableCell className="capitalize">{row.lean}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(row.hit_rate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {signed(row.avg_excess_return_pct)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.by_score_bucket.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Score calibration</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                {/* The question this answers: does a higher score actually
                    produce a higher hit rate? A flat chart here means the
                    composite is not ranking anything, however good any single
                    factor's spread looks below. */}
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_score_bucket}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis
                      domain={[0, 1]}
                      tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value, _name, item) => [
                        `${(Number(value) * 100).toFixed(1)}% (${item?.payload?.count ?? 0} rows)`,
                        'Hit rate',
                      ]}
                    />
                    <Bar dataKey="hit_rate" fill="currentColor" className="text-primary" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">By factor</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factor</TableHead>
                    <TableHead className="text-right">Positive</TableHead>
                    <TableHead className="text-right">Negative</TableHead>
                    <TableHead className="text-right">Spread</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_factor.map((row) => (
                    <TableRow key={row.factor}>
                      <TableCell>{row.factor}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(row.positive_hit_rate)}{' '}
                        <span className="text-muted-foreground">({row.positive_count})</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(row.negative_hit_rate)}{' '}
                        <span className="text-muted-foreground">({row.negative_count})</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {signed(row.spread)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
