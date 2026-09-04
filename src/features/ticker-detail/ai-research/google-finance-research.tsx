import { ExternalLinkIcon, RotateCcwIcon, SearchIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { MessageResponse } from '@/components/ai-elements/message'
import { useGoogleFinanceResearch } from '../hooks'

const GOOGLE_FINANCE_RESEARCH_URL = 'https://www.google.com/finance/beta/#research'

// Starting points only -- picking one fills the box, it never sends. These are
// deliberately questions the web-grounded Google page answers better than our own
// /ai-research read, which never sees the open web.
const PRESET_PROMPTS: { id: string; label: string; build: (ticker: string) => string }[] = [
  {
    id: 'today',
    label: "Today's move",
    build: (t) => `Why is ${t} moving today?`,
  },
  {
    id: 'up',
    label: 'Why it went up',
    build: (t) => `Why has ${t} gone up today, and what is driving the buying?`,
  },
  {
    id: 'down',
    label: 'Why it went down',
    build: (t) => `Why has ${t} gone down today, and what is driving the selling?`,
  },
  {
    id: 'earnings',
    label: 'After earnings',
    build: (t) => `What happened to ${t} after its most recent earnings report, and why?`,
  },
  {
    id: 'catalysts',
    label: 'Recent catalysts',
    build: (t) =>
      `What are the most significant news catalysts for ${t} in the past month, and how did the stock react to each?`,
  },
  {
    id: 'analysts',
    label: 'Analyst view',
    build: (t) =>
      `What have analysts said about ${t} recently, and what are the main bull and bear arguments?`,
  },
  {
    id: 'competitors',
    label: 'Competitive position',
    build: (t) => `How is ${t} positioned against its main competitors right now?`,
  },
  {
    id: 'risks',
    label: 'Key risks',
    build: (t) => `What are the biggest risks facing ${t} over the next 6-12 months?`,
  },
]

function defaultQuestion(ticker: string) {
  return PRESET_PROMPTS[0].build(ticker)
}

export function GoogleFinanceResearch({ ticker }: { ticker: string }) {
  const [question, setQuestion] = useState(() => defaultQuestion(ticker))
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const research = useGoogleFinanceResearch(ticker)
  const result = research.data
  // Nothing to clear until one answer or error is on screen.
  const canClear = Boolean(result) || research.isError
  const publicError = result && !result.source.ok ? result.source.error : null
  const requestError =
    research.error instanceof Error ? research.error.message : 'Could not reach MarketScout.'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = question.trim()
    if (normalized.length >= 3 && !research.isPending) research.mutate(normalized)
  }

  function handlePreset(build: (ticker: string) => string) {
    setQuestion(build(ticker))
    questionRef.current?.focus()
  }

  function handleClear() {
    research.reset()
    setQuestion(defaultQuestion(ticker))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Finance Research</CardTitle>
        <CardDescription>
          Experimental web-grounded research through Google Finance. No MarketScout LLM charge.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
            {PRESET_PROMPTS.map((preset) => {
              const text = preset.build(ticker)
              return (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  // Derived from the textarea, so hand-editing clears it on its own.
                  aria-pressed={question === text}
                  disabled={research.isPending}
                  onClick={() => handlePreset(preset.build)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
          <FieldGroup>
            <Field data-disabled={research.isPending}>
              <FieldLabel htmlFor="google-finance-question">Question</FieldLabel>
              <Textarea
                id="google-finance-question"
                ref={questionRef}
                aria-label="Google Finance question"
                disabled={research.isPending}
                maxLength={1000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <FieldDescription>
                Ask about price moves, catalysts, earnings, risks, or market context for {ticker}.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={research.isPending || question.trim().length < 3}
            >
              {research.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : (
                <SearchIcon data-icon="inline-start" />
              )}
              {research.isPending ? 'Researching…' : 'Ask Google Finance'}
            </Button>
            {canClear ? (
              <Button
                type="button"
                variant="ghost"
                disabled={research.isPending}
                onClick={handleClear}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Clear
              </Button>
            ) : null}
          </div>
        </form>

        {research.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Google Finance request failed</AlertTitle>
            <AlertDescription>{requestError}</AlertDescription>
          </Alert>
        ) : null}

        {publicError ? (
          <Alert variant="destructive">
            <AlertTitle>Google Finance Research unavailable</AlertTitle>
            <AlertDescription>{publicError}</AlertDescription>
          </Alert>
        ) : null}

        {result?.source.ok && result.answer_markdown ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">{result.question}</p>
            <MessageResponse>{result.answer_markdown}</MessageResponse>
            {result.sources.length > 0 ? (
              <ul aria-label="Google Finance sources" className="flex flex-col gap-2 text-sm">
                {result.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      className="text-primary underline underline-offset-4"
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title}
                    </a>
                    {source.publisher ? (
                      <span className="text-muted-foreground">
                        <span aria-hidden="true"> — </span>
                        <span>{source.publisher}</span>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-muted-foreground text-xs">{result.caveat}</p>
            <time className="text-muted-foreground text-xs" dateTime={result.generated_at}>
              {new Date(result.generated_at).toLocaleString()}
            </time>
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm">
          <a
            href={GOOGLE_FINANCE_RESEARCH_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Google Finance
            <ExternalLinkIcon data-icon="inline-end" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}
