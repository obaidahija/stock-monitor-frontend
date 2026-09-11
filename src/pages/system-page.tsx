import { Navigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HealthPanel } from '@/features/system/health-panel'
import { JobsTable } from '@/features/system/jobs-table'
import { SignalPerformanceTab } from '@/features/system/signal-performance-tab'

const SYSTEM_TABS = ['health', 'jobs', 'signals'] as const

export function SystemPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const requestedTab = searchParams.get('tab')
  // AI settings moved to the dedicated Settings page; keep the old deep link working.
  const redirectToSettings = requestedTab === 'ai'
  const activeTab =
    requestedTab && (SYSTEM_TABS as readonly string[]).includes(requestedTab)
      ? requestedTab
      : 'health'

  function handleTabChange(tab: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (tab === 'health') {
          next.delete('tab')
        } else {
          next.set('tab', tab)
        }
        return next
      },
      { replace: true },
    )
  }

  if (redirectToSettings) {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System"
        description="Scheduler health, upstream sources, job runs, and signal performance."
      />
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
        </TabsList>
        <TabsContent value="health">
          <HealthPanel />
        </TabsContent>
        <TabsContent value="jobs">
          <JobsTable />
        </TabsContent>
        <TabsContent value="signals">
          <SignalPerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
