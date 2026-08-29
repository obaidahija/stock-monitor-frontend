import { Bot, MessageSquare } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { Badge } from '@/components/ui/badge'
import type { AiConversationMessageOut, LlmUsageSummaryOut } from '@/types/api'

function formatCost(cost: string | null | undefined) {
  if (!cost) return null
  return `$${Number(cost).toFixed(4)}`
}

export function UsageLine({ usage }: { usage: LlmUsageSummaryOut | null | undefined }) {
  if (!usage) return null
  const total = usage.prompt_tokens + usage.completion_tokens
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{total.toLocaleString()} tokens</span>
      {usage.reasoning_tokens > 0 ? <span>{usage.reasoning_tokens} reasoning</span> : null}
      {formatCost(usage.cost_usd) ? <Badge variant="outline">{formatCost(usage.cost_usd)}</Badge> : null}
    </div>
  )
}

export function ConversationHistory({
  messages,
  thinking,
}: {
  messages: AiConversationMessageOut[]
  thinking: boolean
}) {
  return (
    <Conversation className="h-[32rem] rounded-lg border">
      <ConversationContent>
        {messages.length === 0 ? (
          <ConversationEmptyState
            icon={<MessageSquare />}
            title="Start a research conversation"
            description="Ask about the report, recent evidence, risks, or an attached chart."
          />
        ) : (
          messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.content ? <MessageResponse>{message.content}</MessageResponse> : null}
                {message.attachment_names.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {message.attachment_names.map((name) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <UsageLine usage={message.usage} />
              </MessageContent>
            </Message>
          ))
        )}
        {thinking ? (
          <Message from="assistant">
            <MessageContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot />
                Thinking…
              </div>
            </MessageContent>
          </Message>
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
