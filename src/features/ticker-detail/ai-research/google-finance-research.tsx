import {
  ExternalLinkIcon,
  MessageCircleIcon,
  MessageSquarePlusIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { ConversationEmptyState } from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { useGoogleFinanceResearch } from '../hooks'
import type { GoogleFinanceChatTurnIn, GoogleFinanceResearchOut } from '@/types/api'

const GOOGLE_FINANCE_RESEARCH_URL = 'https://www.google.com/finance/beta/#research'

// Mirrors the backend's MAX_HISTORY_TURNS cap -- keeping the client and server
// aligned avoids sending context the backend would just drop anyway.
const MAX_CLIENT_HISTORY_TURNS = 6

// Fill-only starting points -- picking one loads the composer, it never sends
// on its own, since the ticker-specific wording is still worth a glance before
// asking. Deliberately questions the web-grounded Google page answers better
// than our own /ai-research read, which never sees the open web.
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

function turnToHistory(turn: GoogleFinanceResearchOut): GoogleFinanceChatTurnIn | null {
  if (!turn.source.ok || !turn.answer_markdown) return null
  return { question: turn.question, answer: turn.answer_markdown }
}

// Plain-text glance on the launcher card -- strip the markdown syntax that
// would otherwise leak through as literal '#'/'*'/'-' characters.
function previewText(turn: GoogleFinanceResearchOut): string {
  if (turn.source.ok && turn.answer_markdown) {
    return turn.answer_markdown
      .replaceAll(/^#{1,6}\s+/gm, '')
      .replaceAll(/[*_`]/g, '')
      .replaceAll(/^[-•]\s+/gm, '')
      .replaceAll(/\n+/g, ' ')
      .trim()
  }
  return turn.source.error ?? 'No answer was returned.'
}

function AnswerBubble({ turn }: { turn: GoogleFinanceResearchOut }) {
  if (!turn.source.ok || !turn.answer_markdown) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Google Finance Research unavailable</AlertTitle>
        <AlertDescription>
          {turn.source.error ?? 'No answer was returned.'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <MessageResponse>{turn.answer_markdown}</MessageResponse>
      {turn.sources.length > 0 ? (
        <ul aria-label="Google Finance sources" className="flex flex-col gap-2 text-sm">
          {turn.sources.map((source) => (
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
      <p className="text-muted-foreground text-xs">{turn.caveat}</p>
      <time className="text-muted-foreground text-xs" dateTime={turn.generated_at}>
        {new Date(turn.generated_at).toLocaleString()}
      </time>
    </div>
  )
}

export function GoogleFinanceResearch({ ticker }: { ticker: string }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState(() => defaultQuestion(ticker))
  const [turns, setTurns] = useState<GoogleFinanceResearchOut[]>([])
  const threadRef = useRef<HTMLDivElement>(null)
  const research = useGoogleFinanceResearch(ticker)
  const requestError =
    research.error instanceof Error ? research.error.message : 'Could not reach MarketScout.'
  const lastTurn = turns.at(-1)

  // A new turn lands at the bottom of a bounded, independently scrollable
  // thread -- follow it there explicitly rather than relying on a
  // stick-to-bottom heuristic to notice the content grew.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns.length])

  async function handleAsk({ text }: { text: string }) {
    const normalized = text.trim()
    if (normalized.length < 3 || research.isPending) return

    // PromptInput resets its own field immediately on submit; mirror that in
    // our controlled state so the two don't fight on the next render.
    setQuestion('')

    const history: GoogleFinanceChatTurnIn[] = turns
      .map(turnToHistory)
      .filter((turn): turn is GoogleFinanceChatTurnIn => turn !== null)
      .slice(-MAX_CLIENT_HISTORY_TURNS)

    const result = await research.mutateAsync({ question: normalized, history })
    setTurns((prev) => [...prev, result])
  }

  function handlePreset(build: (ticker: string) => string) {
    setQuestion(build(ticker))
  }

  function handleNewChat() {
    research.reset()
    setTurns([])
    setQuestion(defaultQuestion(ticker))
  }

  const presetRow = (
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
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Finance Research</CardTitle>
        <CardDescription>
          Experimental web-grounded research through Google Finance. No MarketScout LLM charge.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {lastTurn ? (
          <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{lastTurn.question}</p>
            <p className="line-clamp-2 text-muted-foreground">{previewText(lastTurn)}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button type="button">
                <MessageCircleIcon data-icon="inline-start" />
                {turns.length > 0 ? 'Continue chat' : 'Ask Google Finance'}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex gap-0 p-0">
              <SheetHeader>
                <SheetTitle>Google Finance Research</SheetTitle>
                <SheetDescription>
                  {ticker} · web-grounded, no MarketScout LLM charge
                </SheetDescription>
              </SheetHeader>

              <div ref={threadRef} role="log" className="flex-1 overflow-y-auto p-4">
                {turns.length === 0 ? (
                  <ConversationEmptyState
                    icon={<MessageCircleIcon className="size-6" />}
                    title={`Ask about ${ticker}`}
                    description="Price moves, catalysts, earnings, risks, or market context -- answered from the open web."
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {turns.map((turn, index) => (
                      <div key={`${turn.generated_at}-${index}`} className="flex flex-col gap-4">
                        <Message from="user">
                          <MessageContent>{turn.question}</MessageContent>
                        </Message>
                        <Message from="assistant">
                          <MessageContent>
                            <AnswerBubble turn={turn} />
                          </MessageContent>
                        </Message>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t p-4">
                {research.isError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Google Finance request failed</AlertTitle>
                    <AlertDescription>{requestError}</AlertDescription>
                  </Alert>
                ) : null}
                {presetRow}
                <PromptInput onSubmit={handleAsk}>
                  <PromptInputTextarea
                    aria-label="Google Finance question"
                    placeholder={`Ask about ${ticker}...`}
                    disabled={research.isPending}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                  <PromptInputFooter>
                    <PromptInputTools>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={research.isPending || (turns.length === 0 && !research.isError)}
                        onClick={handleNewChat}
                      >
                        <MessageSquarePlusIcon data-icon="inline-start" />
                        New chat
                      </Button>
                    </PromptInputTools>
                    <PromptInputSubmit
                      disabled={research.isPending || question.trim().length < 3}
                    >
                      {research.isPending ? <Spinner aria-hidden="true" /> : undefined}
                    </PromptInputSubmit>
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </SheetContent>
          </Sheet>
          <Button asChild variant="outline" size="sm">
            <a href={GOOGLE_FINANCE_RESEARCH_URL} target="_blank" rel="noopener noreferrer">
              Open Google Finance
              <ExternalLinkIcon data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
