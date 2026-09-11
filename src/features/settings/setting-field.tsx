import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { SettingField, SettingValue } from '@/types/api'

interface Props {
  field: SettingField
  value: SettingValue
  onChange: (value: SettingValue) => void
}

export function SettingFieldControl({ field, value, onChange }: Props) {
  const inputId = `setting-${field.name}`
  const numeric = field.kind === 'int' || field.kind === 'float'

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={inputId} className="text-sm font-medium">
          {field.label}
        </Label>
        <p className="text-muted-foreground mt-0.5 text-xs">{field.description}</p>
        <FieldBadges field={field} />
      </div>

      {field.kind === 'bool' ? (
        <Switch
          id={inputId}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      ) : (
        <Input
          id={inputId}
          type={numeric ? 'number' : 'text'}
          value={String(value)}
          min={field.minimum ?? undefined}
          max={field.maximum ?? undefined}
          step={field.kind === 'float' ? 'any' : 1}
          className="w-44 shrink-0"
          onChange={(event) => {
            const raw = event.target.value
            if (!numeric) {
              onChange(raw)
              return
            }
            const parsed = field.kind === 'int' ? Number.parseInt(raw, 10) : Number.parseFloat(raw)
            // A half-typed or emptied number field stays a string rather than
            // becoming NaN; the form treats it as unchanged until it parses.
            onChange(Number.isNaN(parsed) ? raw : parsed)
          }}
        />
      )}
    </div>
  )
}

function FieldBadges({ field }: { field: SettingField }) {
  if (!field.is_overridden && !field.requires_restart) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {field.is_overridden ? (
        <Badge variant="secondary" className="text-xs font-normal">
          Overridden — default {String(field.default)}
        </Badge>
      ) : null}
      {field.requires_restart ? (
        <Badge variant="outline" className="text-xs font-normal">
          Applies after restart
        </Badge>
      ) : null}
    </div>
  )
}
