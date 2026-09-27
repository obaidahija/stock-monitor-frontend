import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ResearchGroupOut, ResearchPerformanceOut } from '@/types/api'

const signedPct = (value: number | null) =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

function CoverageCells({ group }: { group: ResearchGroupOut }) {
  return <>
    <TableCell className="text-right tabular-nums">{group.coverage.recorded}</TableCell>
    <TableCell className="text-right tabular-nums">{group.coverage.matured}</TableCell>
    <TableCell className="text-right tabular-nums">{group.coverage.evaluated}</TableCell>
    <TableCell className="text-right tabular-nums">{group.coverage.missing}</TableCell>
    <TableCell className="text-right tabular-nums">{group.metrics.excess_return_pct.n}</TableCell>
    <TableCell className="text-right tabular-nums">{signedPct(group.metrics.excess_return_pct.mean)}</TableCell>
    <TableCell className="text-right tabular-nums">{signedPct(group.metrics.excess_return_pct.median)}</TableCell>
  </>
}

export function ResearchScoreGrading({ data }: { data: ResearchPerformanceOut }) {
  const spread = data.score_spread
  return (
    <section aria-label="Score grading" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Score grading</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Raw stock return minus SPY over the same sessions, before costs. These are observations, not trades.</p>
          {spread && <>
            <p>{spread.paired_sessions} paired sessions / {spread.eligible_sessions} eligible / {spread.total_sessions} recorded sessions</p>
            <p>Top minus bottom score quartile: mean <strong>{signedPct(spread.mean_daily_spread_pct)}</strong> · median {signedPct(spread.median_daily_spread_pct)}</p>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Quartile</TableHead><TableHead className="text-right">Recorded</TableHead>
                <TableHead className="text-right">Mature</TableHead><TableHead className="text-right">Evaluated</TableHead>
                <TableHead className="text-right">Missing</TableHead><TableHead className="text-right">SPY n</TableHead>
              </TableRow></TableHeader>
              <TableBody>{([['Top', spread.top], ['Bottom', spread.bottom]] as const).map(([label, group]) =>
                <TableRow key={label}>
                  <TableCell>{label}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.coverage.recorded}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.coverage.matured}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.coverage.evaluated}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.coverage.missing}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.metrics.excess_return_pct.n}</TableCell>
                </TableRow>)}</TableBody>
            </Table></div>
            <p className="text-muted-foreground text-xs">Ranked before outcomes. Pooled side counts include unpaired sessions; each paired session has equal weight in the spread.</p>
          </>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Score buckets</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {data.by_score_bucket.length === 0 ? (
            <p className="text-muted-foreground text-sm">No frozen scores in this cohort.</p>
          ) : <Table>
            <TableHeader><TableRow>
              <TableHead>Bucket</TableHead><TableHead className="text-right">Recorded</TableHead>
              <TableHead className="text-right">Mature</TableHead><TableHead className="text-right">Evaluated</TableHead>
              <TableHead className="text-right">Missing</TableHead><TableHead className="text-right">SPY n</TableHead>
              <TableHead className="text-right">Mean vs SPY</TableHead><TableHead className="text-right">Median vs SPY</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.by_score_bucket.map((group) => <TableRow key={group.key}>
              <TableCell>{group.key}</TableCell><CoverageCells group={group} />
            </TableRow>)}</TableBody>
          </Table>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Frozen factors</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {data.by_factor.length === 0 ? <p className="text-muted-foreground text-sm">No factor scores in this cohort.</p> :
            data.by_factor.map((factor) => <div key={factor.factor} className="space-y-1 overflow-x-auto">
              <p className="text-sm font-medium">{factor.factor}</p>
              <p className="text-muted-foreground text-xs">Positive minus negative mean vs SPY: {signedPct(factor.positive_minus_negative_excess_pct)}</p>
              <Table><TableHeader><TableRow>
                <TableHead>Factor sign</TableHead><TableHead className="text-right">Recorded</TableHead>
                <TableHead className="text-right">Mature</TableHead><TableHead className="text-right">Evaluated</TableHead>
                <TableHead className="text-right">Missing</TableHead><TableHead className="text-right">SPY n</TableHead>
                <TableHead className="text-right">Mean vs SPY</TableHead><TableHead className="text-right">Median vs SPY</TableHead>
              </TableRow></TableHeader><TableBody>
                {(['positive', 'zero', 'negative', 'missing'] as const).map((sign) => <TableRow key={sign}>
                  <TableCell className="capitalize">{sign}</TableCell><CoverageCells group={factor[sign]} />
                </TableRow>)}
              </TableBody></Table>
            </div>)}
        </CardContent>
      </Card>
    </section>
  )
}
