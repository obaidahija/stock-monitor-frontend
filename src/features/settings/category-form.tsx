import { useEffect, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingFieldControl } from './setting-field'
import { useResetSettingsCategory, useUpdateSettingsCategory } from './hooks'
import type { SettingValue, SettingsCategory } from '@/types/api'

export function SettingsCategoryForm({ category }: { category: SettingsCategory }) {
  const [edits, setEdits] = useState<Record<string, SettingValue>>({})
  const update = useUpdateSettingsCategory()
  const reset = useResetSettingsCategory()

  // Drop pending edits when the server's copy of this category changes --
  // a successful save or reset returns the authoritative values.
  useEffect(() => setEdits({}), [category])

  const changed = Object.entries(edits).filter(([name, value]) => {
    const field = category.fields.find((candidate) => candidate.name === name)
    return field !== undefined && value !== field.value
  })

  function valueOf(name: string, fallback: SettingValue): SettingValue {
    return name in edits ? edits[name] : fallback
  }

  const error = update.error ?? reset.error

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>{category.label}</CardTitle>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reset.isPending}
            onClick={() => reset.mutate(category.name)}
          >
            <RotateCcw className="size-3.5" />
            Reset to defaults
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={changed.length === 0 || update.isPending}
            onClick={() =>
              update.mutate({ name: category.name, values: Object.fromEntries(changed) })
            }
          >
            <Save className="size-3.5" />
            Save
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <p role="alert" className="text-destructive mb-3 text-sm">
            {error instanceof Error ? error.message : String(error)}
          </p>
        ) : null}

        <div className="divide-y">
          {category.fields.map((field) => (
            <SettingFieldControl
              key={field.name}
              field={field}
              value={valueOf(field.name, field.value)}
              onChange={(value) => setEdits((previous) => ({ ...previous, [field.name]: value }))}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
