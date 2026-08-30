import { Check, ChevronsUpDown, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type {
  AiProvider,
  AiSettingsOut,
  AiSettingsUpdate,
  OpenRouterModelOut,
} from '@/types/api'
import { useAiSettings, useOpenRouterModels, useUpdateAiSettings } from './hooks'

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'llamacpp', label: 'llama.cpp' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
]

function ProviderSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: AiProvider
  onChange: (provider: AiProvider) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(provider) => onChange(provider as AiProvider)}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider.value} value={provider.value}>
                {provider.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

// OpenRouter reports a free model as the string "0" for both prices. Test the
// price rather than a ":free" suffix -- a few free models (e.g. the Lyria
// previews) carry no suffix, and a model can stop being free without renaming.
function isFreeModel(model: OpenRouterModelOut) {
  return model.prompt_price === '0' && model.completion_price === '0'
}

function ModelCatalogSelect({
  label,
  models,
  value,
  onChange,
}: {
  label: string
  models: OpenRouterModelOut[]
  value: string
  onChange: (model: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)
  const selected = models.find((model) => model.id === value)
  const visibleModels = freeOnly ? models.filter(isFreeModel) : models
  const freeCount = models.filter(isFreeModel).length
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-label={label}
            className="w-full justify-between"
            role="combobox"
            variant="outline"
          >
            <span className="truncate">{selected?.name ?? value}</span>
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Search OpenRouter models…" />
            <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
              <label className="text-sm" htmlFor="free-models-only">
                Free models only
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{freeCount} free</span>
                <Switch
                  aria-label="Free models only"
                  checked={freeOnly}
                  id="free-models-only"
                  onCheckedChange={setFreeOnly}
                />
              </div>
            </div>
            <CommandList>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {visibleModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`${model.name} ${model.id}`}
                    onSelect={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn(model.id === value ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{model.name}</span>
                    {isFreeModel(model) ? (
                      <Badge className="ml-auto" variant="secondary">
                        Free
                      </Badge>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected ? <ModelMetadata model={selected} /> : null}
    </Field>
  )
}

function ModelMetadata({ model }: { model: OpenRouterModelOut }) {
  return (
    <div className="flex flex-wrap gap-2">
      {model.context_length ? (
        <Badge variant="secondary">{model.context_length.toLocaleString()} context</Badge>
      ) : null}
      {model.input_modalities.includes('image') ? (
        <Badge variant="outline">Image input</Badge>
      ) : null}
      {model.supported_parameters.includes('reasoning') ? (
        <Badge variant="outline">Reasoning</Badge>
      ) : null}
      {isFreeModel(model) ? <Badge variant="secondary">Free</Badge> : null}
      {!isFreeModel(model) && model.prompt_price ? (
        <Badge variant="outline">Input ${model.prompt_price}/token</Badge>
      ) : null}
      {!isFreeModel(model) && model.completion_price ? (
        <Badge variant="outline">Output ${model.completion_price}/token</Badge>
      ) : null}
    </div>
  )
}

function ManualModelField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (model: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      <FieldDescription>Enter the exact model ID exposed by this provider.</FieldDescription>
    </Field>
  )
}

function SettingsEditor({
  initial,
  models,
  catalogFailed,
}: {
  initial: AiSettingsOut
  models: OpenRouterModelOut[]
  catalogFailed: boolean
}) {
  const [form, setForm] = useState<AiSettingsUpdate>(() => ({
    research: { ...initial.research },
    summarization: { ...initial.summarization },
  }))
  const update = useUpdateAiSettings()
  const researchModel = models.find((model) => model.id === form.research.model)
  const canReason = form.research.provider === 'openrouter'
  const canStream = form.research.provider === 'openrouter'
  const canUseChart =
    form.research.provider === 'openrouter' &&
    (catalogFailed || researchModel?.input_modalities.includes('image') === true)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    try {
      await update.mutateAsync(form)
      toast.success('AI settings saved.')
    } catch {
      toast.error('Could not save AI settings.')
    }
  }

  // Switching providers must not leave the previous provider's model ID in the
  // field (an Ollama tag is meaningless to OpenRouter). Fall back to the saved
  // model when switching back to the saved provider, and to that provider's
  // server-configured default otherwise.
  function modelForProvider(
    provider: AiProvider,
    saved: { provider: AiProvider; model: string },
  ) {
    return provider === saved.provider
      ? saved.model
      : initial.providers[provider].default_model
  }

  function setResearchProvider(provider: AiProvider) {
    setForm((current) => ({
      ...current,
      research: {
        ...current.research,
        provider,
        model: modelForProvider(provider, initial.research),
      },
    }))
  }

  function setSummarizationProvider(provider: AiProvider) {
    setForm((current) => ({
      ...current,
      summarization: {
        ...current.summarization,
        provider,
        model: modelForProvider(provider, initial.summarization),
      },
    }))
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Research</h2>
            </CardTitle>
            <CardDescription>
              Provider and capabilities used for structured reports and research chat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ProviderSelect
                id="research-provider"
                label="Research provider"
                value={form.research.provider}
                onChange={setResearchProvider}
              />
              {form.research.provider === 'openrouter' && models.length > 0 ? (
                <ModelCatalogSelect
                  label="Research model"
                  models={models}
                  value={form.research.model}
                  onChange={(model) =>
                    setForm((current) => ({
                      ...current,
                      research: { ...current.research, model },
                    }))
                  }
                />
              ) : (
                <ManualModelField
                  id="research-model"
                  label="Research model"
                  value={form.research.model}
                  onChange={(model) =>
                    setForm((current) => ({
                      ...current,
                      research: { ...current.research, model },
                    }))
                  }
                />
              )}
              {catalogFailed && form.research.provider === 'openrouter' ? (
                <Alert>
                  <AlertTitle>OpenRouter catalog is unavailable</AlertTitle>
                  <AlertDescription>
                    You can still enter and save an OpenRouter model ID manually.
                  </AlertDescription>
                </Alert>
              ) : null}
              <FieldSet>
                <FieldLegend variant="label">Research capabilities</FieldLegend>
                <FieldGroup>
                  <CapabilitySwitch
                    label="Reasoning"
                    checked={form.research.reasoning_enabled}
                    disabled={!canReason}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        research: { ...current.research, reasoning_enabled: checked },
                      }))
                    }
                    description="Shows a generic thinking state; private reasoning is never displayed."
                  />
                  <CapabilitySwitch
                    label="Streaming"
                    checked={form.research.streaming_enabled}
                    disabled={!canStream}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        research: { ...current.research, streaming_enabled: checked },
                      }))
                    }
                    description="Streams research chat responses when the provider supports it."
                  />
                  <CapabilitySwitch
                    label="Automatic chart inclusion"
                    checked={form.research.include_chart}
                    disabled={!canUseChart}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        research: { ...current.research, include_chart: checked },
                      }))
                    }
                    description="Adds a transient MarketScout chart to image-capable requests."
                  />
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Badge variant={initial.providers[form.research.provider].configured ? 'secondary' : 'outline'}>
              {form.research.provider === 'openrouter' ? 'OpenRouter key ' : 'Provider '}
              {initial.providers[form.research.provider].configured ? 'configured' : 'not configured'}
            </Badge>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Summarization</h2>
            </CardTitle>
            <CardDescription>
              Independent profile for social evidence map summaries and compact text tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ProviderSelect
                id="summarization-provider"
                label="Summarization provider"
                value={form.summarization.provider}
                onChange={setSummarizationProvider}
              />
              {form.summarization.provider === 'openrouter' && models.length > 0 ? (
                <ModelCatalogSelect
                  label="Summarization model"
                  models={models}
                  value={form.summarization.model}
                  onChange={(model) =>
                    setForm((current) => ({
                      ...current,
                      summarization: { ...current.summarization, model },
                    }))
                  }
                />
              ) : (
                <ManualModelField
                  id="summarization-model"
                  label="Summarization model"
                  value={form.summarization.model}
                  onChange={(model) =>
                    setForm((current) => ({
                      ...current,
                      summarization: { ...current.summarization, model },
                    }))
                  }
                />
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Badge variant={initial.providers[form.summarization.provider].configured ? 'secondary' : 'outline'}>
              {initial.providers[form.summarization.provider].configured
                ? 'Provider configured'
                : 'Provider not configured'}
            </Badge>
          </CardFooter>
        </Card>
      </div>
      <div className="flex justify-end">
        <Button disabled={update.isPending} type="submit">
          <Save data-icon="inline-start" />
          {update.isPending ? 'Saving…' : 'Save AI settings'}
        </Button>
      </div>
    </form>
  )
}

function CapabilitySwitch({
  label,
  checked,
  disabled,
  description,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  description: string
  onCheckedChange: (checked: boolean) => void
}) {
  const id = `capability-${label.toLowerCase().replaceAll(' ', '-')}`
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <div className="flex flex-1 flex-col gap-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </div>
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </Field>
  )
}

export function AiSettingsForm() {
  const settings = useAiSettings()
  const catalog = useOpenRouterModels(Boolean(settings.data))

  if (settings.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }
  if (settings.isError || !settings.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>AI settings unavailable</AlertTitle>
        <AlertDescription>Check the backend connection and try again.</AlertDescription>
      </Alert>
    )
  }
  return (
    <SettingsEditor
      key={settings.data.updated_at}
      initial={settings.data}
      models={catalog.data ?? []}
      catalogFailed={catalog.isError}
    />
  )
}
