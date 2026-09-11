import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { AiSettingsForm } from '@/features/ai-settings/ai-settings-form'
import { SettingsCategoryForm } from '@/features/settings/category-form'
import { useSettings } from '@/features/settings/hooks'
import { cn } from '@/lib/utils'

const AI_CATEGORY = 'ai'

export function SettingsPage() {
  const { data, isLoading, error } = useSettings()
  const [selected, setSelected] = useState(AI_CATEGORY)

  const categories = data?.categories ?? []
  const active = categories.find((category) => category.name === selected)

  function navButtonClass(name: string) {
    return cn(
      'rounded-md px-3 py-1.5 text-left text-sm transition-colors',
      selected === name
        ? 'bg-accent text-accent-foreground font-medium'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Application-wide configuration. Changes apply without a restart unless a field says otherwise; anything you never change here keeps following .env."
      />

      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="flex shrink-0 flex-row flex-wrap gap-1 md:w-56 md:flex-col md:flex-nowrap">
          <button type="button" className={navButtonClass(AI_CATEGORY)} onClick={() => setSelected(AI_CATEGORY)}>
            AI
          </button>
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              className={navButtonClass(category.name)}
              onClick={() => setSelected(category.name)}
            >
              {category.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              Could not load settings.
            </p>
          ) : null}
          {isLoading ? <p className="text-muted-foreground text-sm">Loading settings…</p> : null}
          {selected === AI_CATEGORY ? (
            <>
              <p className="text-muted-foreground text-sm">
                Independent providers and models per task — research, summarization, and the
                background profiles below. API keys remain server-side and are never sent to the
                browser.
              </p>
              <AiSettingsForm />
            </>
          ) : null}
          {active ? <SettingsCategoryForm category={active} /> : null}
        </div>
      </div>
    </div>
  )
}
