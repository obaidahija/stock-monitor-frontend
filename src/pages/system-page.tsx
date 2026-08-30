import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HealthPanel } from '@/features/system/health-panel'
import { JobsTable } from '@/features/system/jobs-table'
import { AiSettingsForm } from '@/features/ai-settings/ai-settings-form'

const SYSTEM_TABS = ['health', 'jobs', 'ai'] as const

export function SystemPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const requestedTab = searchParams.get('tab')
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="System"
        description="Scheduler health, upstream sources, job runs, and AI provider settings."
      />
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="health">
          <HealthPanel />
        </TabsContent>
        <TabsContent value="jobs">
          <JobsTable />
        </TabsContent>
        <TabsContent value="ai">
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Independent providers and models for research and summarization. API keys remain
              server-side and are never sent to the browser.
            </p>
            <AiSettingsForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
