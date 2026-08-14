import { ListOrdered, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/shared/error-state'
import { StatusPill } from '@/components/shared/status-pill'
import { formatRelativeTime } from '@/lib/format'
import { useJobs, useRunJob, useRunJobsInOrder } from './hooks'
import { JobProgressBar } from './job-progress-bar'
import { PROGRESS_CAPABLE_JOBS } from './job-progress-config'
import type { JobInfo } from '@/types/api'

type JobGroup = {
  key: string
  title: string
  description: string
  jobNames: string[]
  ordered: boolean
}

const JOB_GROUPS: JobGroup[] = [
  {
    key: 'ticker-sync',
    title: 'Tracked-universe pipeline',
    description:
      'Run these in order to refresh data (and daily scores) for every tracked ticker ' +
      'immediately instead of waiting for the schedule. sentiment_classify depends on ' +
      'news_ingest, and universe_score depends on all the others having run first — ' +
      'jobs below are numbered in the order to run them.',
    jobNames: [
      'edgar_poll_tracked',
      'earnings_sync',
      'news_ingest',
      'sentiment_classify',
      'reddit_scan',
      'universe_score',
    ],
    ordered: true,
  },
  {
    key: 'market-wide',
    title: 'Market-wide',
    description:
      'Not ticker-specific — a single call regardless of how many tickers are tracked, ' +
      'so it never needs re-running for one new ticker. Run order doesn’t matter.',
    jobNames: ['edgar_poll', 'market_context_sync', 'digest_build'],
    ordered: false,
  },
  {
    key: 'twitter-collection',
    title: 'Twitter collection',
    description:
      'Trusted accounts and selected monitored tickers refresh every four hours. ' +
      'Sentiment classification and retention run independently; each job can be triggered manually.',
    jobNames: [
      'twitter_trusted_sweep',
      'twitter_monitored_ticker_sweep',
      'twitter_sentiment_classify',
      'twitter_retention',
    ],
    ordered: false,
  },
]

function JobRow({
  job,
  order,
  disabled,
  onRun,
}: {
  job: JobInfo
  order?: number
  disabled: boolean
  onRun: () => void
}) {
  return (
    <>
      <TableRow>
        <TableCell className="font-medium">
          <span className="inline-flex items-center gap-2">
            {order !== undefined && (
              <span className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {order}
              </span>
            )}
            {job.name}
          </span>
        </TableCell>
        <TableCell>
          {job.last_run_at ? (
            <span className="inline-flex items-center gap-2">
              <StatusPill ok={job.last_run_status === 'success'} label={job.last_run_status ?? '—'} />
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(job.last_run_at)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">never run</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {job.next_run_at ? formatRelativeTime(job.next_run_at) : '—'}
        </TableCell>
        <TableCell>
          <Button variant="outline" size="sm" disabled={disabled} onClick={onRun}>
            <Play />
            Run
          </Button>
        </TableCell>
      </TableRow>
      {PROGRESS_CAPABLE_JOBS.has(job.name) && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="pt-0 pb-2">
            <JobProgressBar jobName={job.name} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function JobsTable() {
  const { data, isPending, isError, error, refetch } = useJobs()
  const runJob = useRunJob()
  const runJobsInOrder = useRunJobsInOrder()

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  const jobsByName = new Map(data.map((job) => [job.name, job]))
  const grouped = new Set(JOB_GROUPS.flatMap((group) => group.jobNames))
  const ungrouped = data.filter((job) => !grouped.has(job.name))

  const anyRunPending = runJob.isPending || runJobsInOrder.isPending

  function runSingle(jobName: string) {
    runJob.mutate(jobName, {
      onSuccess: (result) =>
        toast[result.status === 'success' ? 'success' : 'error'](`${jobName}: ${result.status}`),
      onError: () => toast.error(`Failed to trigger ${jobName}`),
    })
  }

  function runGroupInOrder(group: JobGroup) {
    runJobsInOrder.mutate({
      jobNames: group.jobNames,
      onStepSettled: (jobName, result, error) => {
        if (error) {
          toast.error(`Failed to trigger ${jobName} — stopped the chain`)
        } else if (result) {
          toast[result.status === 'success' ? 'success' : 'error'](
            result.status === 'success'
              ? `${jobName}: success`
              : `${jobName}: ${result.status} — stopped the chain`,
          )
        }
      },
    })
  }

  return (
    <div className="space-y-6">
      {JOB_GROUPS.map((group) => (
        <Card key={group.key}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{group.title}</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">{group.description}</p>
            </div>
            {group.ordered && (
              <Button
                size="sm"
                disabled={anyRunPending}
                onClick={() => runGroupInOrder(group)}
                className="shrink-0"
              >
                <ListOrdered />
                Run all in order
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.jobNames.map((jobName, i) => {
                  const job = jobsByName.get(jobName)
                  if (!job) return null
                  return (
                    <JobRow
                      key={jobName}
                      job={job}
                      order={group.ordered ? i + 1 : undefined}
                      disabled={anyRunPending}
                      onRun={() => runSingle(jobName)}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {ungrouped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ungrouped.map((job) => (
                  <JobRow
                    key={job.name}
                    job={job}
                    disabled={anyRunPending}
                    onRun={() => runSingle(job.name)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
