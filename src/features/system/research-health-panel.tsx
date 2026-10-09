import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
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
import type { ShortSqueezeMonitoringOut } from '@/types/api'
import { useResearchMonitoring } from './hooks'

const HORIZONS = [1, 3, 5, 7] as const
const COVERAGE_REVIEW_THRESHOLD = 0.95

const coverage = (value: number | null) =>
  value === null ? 'Unknown' : `${(value * 100).toFixed(1)}%`
const number = (value: number | null, digits = 2) =>
  value === null ? '—' : value.toFixed(digits)
const signedPct = (value: number | null) =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

function ShortSqueezeHealth({ scanner }: { scanner: ShortSqueezeMonitoringOut }) {
  const failed = scanner.checkpoints.failed ?? 0
  const pending = scanner.checkpoints.pending ?? 0
  return (
    <section aria-label="Short Squeeze scanner">
      <Card>
        <CardHeader>
          <CardTitle>Short Squeeze scanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            {scanner.collection_enabled ? 'Collecting' : 'Collection off'} ·{' '}
            {scanner.latest_target_session
              ? `latest session ${scanner.latest_target_session}`
              : 'No scan published yet'}
            {scanner.corrections > 0 && ` · ${scanner.corrections} corrected`}
          </p>
          {scanner.coverage && (
            <p className="text-muted-foreground">
              {scanner.coverage.evaluated} evaluated / {scanner.coverage.matched} matched /{' '}
              {scanner.coverage.incomplete} incomplete · {scanner.observations_recorded} observations
              recorded
            </p>
          )}
          {(failed > 0 || pending > 0) && (
            <p className="text-amber-700 dark:text-amber-300">
              Warm-up incomplete: {failed} failed, {pending} pending
              {scanner.checkpoint_target_session && ` for ${scanner.checkpoint_target_session}`}. Gain
              matches still work; the prior-high branch stays unknown until history arrives.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

/** Stored evidence only; loading this tab does not start a research job. */
export function ResearchHealthPanel() {
  const [horizon, setHorizon] = useState<1 | 3 | 5 | 7>(1)
  const report = useResearchMonitoring(horizon)
  const data = report.data
  const latestCoverage = data?.bar_sessions[0]?.checkpoint_coverage_pct ?? null
  const historicalGaps = data?.bar_sessions.slice(1).filter(
    (row) => row.checkpoint_coverage_pct !== null && row.checkpoint_coverage_pct < COVERAGE_REVIEW_THRESHOLD,
  ) ?? []

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Current daily-bar coverage, frozen catalyst evidence, and actual use. Returns are descriptive;
        headline relevance still needs manual review.
      </p>
      {report.isPending && <p className="text-muted-foreground text-sm">Loading research health…</p>}
      {report.isError && (
        <button className="text-destructive text-sm underline" onClick={() => void report.refetch()}>
          Could not load research health. Retry
        </button>
      )}
      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Daily bars by finalized session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 overflow-x-auto">
              {latestCoverage !== null && latestCoverage < COVERAGE_REVIEW_THRESHOLD && (
                <p className="text-amber-700 text-sm dark:text-amber-300">
                  Investigate latest coverage below 95% before interpreting new catalyst returns.
                </p>
              )}
              {historicalGaps.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  Historical sync gap: {historicalGaps.map((row) => row.session_date).join(', ')} fell
                  below 95% at the last sync. Frozen candidate baselines keep their original status.
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead className="text-right">Complete now</TableHead>
                    <TableHead className="text-right">Expected at sync</TableHead>
                    <TableHead className="text-right">At last sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bar_sessions.map((row) => (
                    <TableRow key={row.session_date}>
                      <TableCell>{row.session_date}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.complete_symbols}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.expected_symbols ?? 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.checkpoint_synced === null
                          ? 'Unknown'
                          : `${row.checkpoint_synced} (${coverage(row.checkpoint_coverage_pct)})`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-muted-foreground text-xs">
                Last-sync coverage uses its exact stored numerator and denominator. Current complete
                bars may include late arrivals and symbols outside that saved denominator; they are
                shown as a count only. A missing checkpoint is unknown. Late bars do not repair a
                candidate&apos;s frozen baseline.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frozen catalyst baselines by baseline session</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.baseline_sessions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No candidate baselines in this window.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Baseline session</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead className="text-right">Full</TableHead>
                      <TableHead className="text-right">Partial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.baseline_sessions.map((row) => (
                      <TableRow key={`${row.baseline_session ?? 'unknown'}-${row.rule_version}`}>
                        <TableCell>{row.baseline_session ?? 'Unknown'}</TableCell>
                        <TableCell className="font-mono text-xs">{row.rule_version}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.complete}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.partial}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle>Catalyst evidence by rule and baseline</CardTitle>
              <Tabs value={String(horizon)} onValueChange={(value) => setHorizon(Number(value) as typeof horizon)}>
                <TabsList>
                  {HORIZONS.map((value) => (
                    <TabsTrigger key={value} value={String(value)}>
                      {value} {value === 1 ? 'session' : 'sessions'}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.current_catalyst_rule_version && !data.catalyst_cohorts.some(
                (row) => row.rule_version === data.current_catalyst_rule_version,
              ) && (
                <p className="text-muted-foreground mb-3 text-sm">
                  No {data.current_catalyst_rule_version} candidates in this lookback. Check the live
                  feed after the scanner rollout.
                </p>
              )}
              {data.catalyst_cohorts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No catalyst cohorts in this window.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead className="text-right">Candidates</TableHead>
                      <TableHead className="text-right">Daily</TableHead>
                      <TableHead className="text-right">Reaction</TableHead>
                      <TableHead className="text-right">ATR reaction</TableHead>
                      <TableHead className="text-right">Volume ratio</TableHead>
                      <TableHead className="text-right">Recorded / mature / evaluated / missing</TableHead>
                      <TableHead className="text-right">SPY excess</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.catalyst_cohorts.map((row) => (
                      <TableRow key={`${row.rule_version}-${row.baseline_status}`}>
                        <TableCell className="font-mono text-xs">{row.rule_version}</TableCell>
                        <TableCell>
                          <Badge variant={row.baseline_status === 'full' ? 'secondary' : 'outline'}>
                            {row.baseline_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.candidates}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.daily_measured}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {signedPct(row.mean_reaction_pct)} ({row.reaction_pct_n})
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {number(row.mean_reaction_atr)} ({row.reaction_atr_n})
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {number(row.mean_volume_ratio)} ({row.volume_ratio_n})
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.outcomes_recorded} / {row.outcomes_matured} /{' '}
                          {row.outcomes_evaluated} / {row.outcomes_missing}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {signedPct(row.mean_excess_return_pct)} ({row.excess_return_n})
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-muted-foreground mt-3 text-xs">
                Candidates have a frozen baseline in the latest ten finalized sessions; those with
                an unknown baseline are included when published in that span.{' '}
                Metrics are never pooled across rule versions or full/partial baselines. SPY excess is
                a future close-to-close observation, not a trade or proof that the headline is relevant.
              </p>
            </CardContent>
          </Card>

          {data.short_squeeze && <ShortSqueezeHealth scanner={data.short_squeeze} />}

          <Card>
            <CardHeader>
              <CardTitle>Manual research use</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              <p>
                {data.usage.follow_through.total} follow-through{' '}
                {data.usage.follow_through.total === 1 ? 'track' : 'tracks'} ·{' '}
                {data.usage.follow_through.active} active ·{' '}
                {data.usage.follow_through.started_30d} started in 30 days
              </p>
              <p>
                {data.usage.subscriptions.total} intraday subscriptions ·{' '}
                {data.usage.subscriptions.enabled} enabled ·{' '}
                {data.usage.subscriptions.ever_succeeded} ever collected
              </p>
              <p>
                {data.usage.setup_revisions.manual_total} manual setup revisions ·{' '}
                {data.usage.setup_revisions.automated_total} AI-managed revisions ·{' '}
                {data.usage.setup_revisions.manual_edits} manual edits
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
