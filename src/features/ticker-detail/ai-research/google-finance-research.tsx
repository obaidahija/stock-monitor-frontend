import { ExternalLinkIcon, RotateCcwIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
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

function defaultQuestion(ticker: string) {
  return `Why is ${ticker} moving today?`
}

export function GoogleFinanceResearch({ ticker }: { ticker: string }) {
  const [question, setQuestion] = useState(() => defaultQuestion(ticker))
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
          <FieldGroup>
            <Field data-disabled={research.isPending}>
              <FieldLabel htmlFor="google-finance-question">Question</FieldLabel>
              <Textarea
                id="google-finance-question"
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
