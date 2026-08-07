import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { useJobs, useRunJob } from './hooks'

export function JobsTable() {
  const { data, isPending, isError, error, refetch } = useJobs()
  const runJob = useRunJob()

  if (isPending) return <Skeleton className="h-64 rounded-xl" />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return null

  return (
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
        {data.map((job) => (
          <TableRow key={job.name}>
            <TableCell className="font-medium">{job.name}</TableCell>
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
              <Button
                variant="outline"
                size="sm"
                disabled={runJob.isPending}
                onClick={() =>
                  runJob.mutate(job.name, {
                    onSuccess: (result) =>
                      toast[result.status === 'success' ? 'success' : 'error'](
                        `${job.name}: ${result.status}`,
                      ),
                    onError: () => toast.error(`Failed to trigger ${job.name}`),
                  })
                }
              >
                <Play />
                Run
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
