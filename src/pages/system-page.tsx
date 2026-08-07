import { PageHeader } from '@/components/shared/page-header'
import { HealthPanel } from '@/features/system/health-panel'
import { JobsTable } from '@/features/system/jobs-table'

export function SystemPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="System" description="Scheduler health, upstream sources, and job runs." />
      <HealthPanel />
      <section className="space-y-3">
        <h2 className="font-semibold">Jobs</h2>
        <JobsTable />
      </section>
    </div>
  )
}
