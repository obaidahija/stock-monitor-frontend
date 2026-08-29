import { PageHeader } from '@/components/shared/page-header'
import { AiSettingsForm } from '@/features/ai-settings/ai-settings-form'

export function AiSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="AI Settings"
        description="Choose independent providers and models for research and summarization. API keys remain server-side."
      />
      <AiSettingsForm />
    </div>
  )
}
