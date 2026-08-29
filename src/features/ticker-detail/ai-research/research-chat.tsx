import { MessageSquarePlus, Paperclip, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments'
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
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
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  createAiConversation,
  deleteAiConversation,
  getAiConversation,
  listAiConversations,
} from '@/api/ai'
import type { AiConversationOut } from '@/types/api'
import { ConversationHistory, UsageLine } from './conversation-history'
import { useResearchStream } from './use-research-stream'

const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf,video/mp4,video/webm'
const MAX_FILE_BYTES = 20 * 1024 * 1024

function AttachmentPreviewList() {
  const attachments = usePromptInputAttachments()
  if (attachments.files.length === 0) return null
  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  )
}

function AddAttachmentButton() {
  const attachments = usePromptInputAttachments()
  return (
    <PromptInputButton
      aria-label="Add attachment"
      onClick={() => attachments.openFileDialog()}
      tooltip="Add image, PDF, or video"
    >
      <Paperclip />
    </PromptInputButton>
  )
}

function ConversationSession({ detail }: { detail: AiConversationOut }) {
  const [input, setInput] = useState('')
  const [includeChart, setIncludeChart] = useState(false)
  const stream = useResearchStream(detail.id)
  const messages = [...detail.messages, ...stream.localMessages]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{detail.provider}</Badge>
          <Badge variant="outline">{detail.model}</Badge>
          {detail.reasoning_enabled ? <Badge variant="outline">Reasoning</Badge> : null}
          {detail.streaming_enabled ? <Badge variant="outline">Streaming</Badge> : null}
        </div>
        <UsageLine usage={detail.usage} />
      </div>

      <ConversationHistory messages={messages} thinking={stream.thinking} />

      {stream.error ? (
        <Alert variant="destructive">
          <AlertTitle>Research chat error</AlertTitle>
          <AlertDescription>{stream.error}</AlertDescription>
          {stream.canRetry ? (
            <Button
              disabled={stream.isStreaming}
              onClick={() => stream.retry()}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <PromptInput
        accept={ATTACHMENT_ACCEPT}
        maxFiles={4}
        maxFileSize={MAX_FILE_BYTES}
        multiple
        onError={(error) =>
          stream.setError(
            error.code === 'max_files'
              ? 'At most four attachments are allowed.'
              : error.message,
          )
        }
        onSubmit={async (message) => {
          if (!message.text.trim()) return
          try {
            await stream.send({
              text: message.text.trim(),
              files: message.files,
              includeChart,
            })
            setInput('')
          } catch (error) {
            stream.setError(error instanceof Error ? error.message : 'Could not send message')
            throw error
          }
        }}
      >
        <PromptInputHeader>
          <AttachmentPreviewList />
        </PromptInputHeader>
        <PromptInputBody>
          <PromptInputTextarea
            disabled={stream.isStreaming}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a research follow-up…"
            value={input}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <AddAttachmentButton />
            <Field orientation="horizontal">
              <FieldLabel htmlFor={`include-chart-${detail.id}`}>Include MarketScout chart</FieldLabel>
              <Switch
                id={`include-chart-${detail.id}`}
                aria-label="Include MarketScout chart"
                checked={includeChart}
                disabled={stream.isStreaming}
                onCheckedChange={setIncludeChart}
              />
            </Field>
          </PromptInputTools>
          <PromptInputSubmit
            disabled={!input.trim() && !stream.isStreaming}
            onStop={stream.stop}
            status={stream.isStreaming ? 'streaming' : stream.error ? 'error' : 'ready'}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

export function ResearchChat({ ticker }: { ticker: string }) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const conversations = useQuery({
    queryKey: ['ai-conversations', ticker],
    queryFn: () => listAiConversations(ticker),
  })
  const activeId = selectedId ?? conversations.data?.[0]?.id ?? null
  const detail = useQuery({
    queryKey: ['ai-conversation', activeId],
    queryFn: () => getAiConversation(activeId as number),
    enabled: activeId !== null,
  })
  const create = useMutation({
    mutationFn: () => createAiConversation(ticker),
    onSuccess: async (created) => {
      setSelectedId(created.id)
      await queryClient.invalidateQueries({ queryKey: ['ai-conversations', ticker] })
    },
  })
  const remove = useMutation({
    mutationFn: deleteAiConversation,
    onSuccess: async () => {
      setSelectedId(null)
      await queryClient.invalidateQueries({ queryKey: ['ai-conversations', ticker] })
    },
  })

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>
                <h2>Research Chat</h2>
              </CardTitle>
              <CardDescription>
                Follow up on the structured report with persistent, research-only conversation.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                disabled={create.isPending}
                onClick={() => create.mutate()}
                size="sm"
                variant="outline"
              >
                <MessageSquarePlus data-icon="inline-start" />
                New conversation
              </Button>
              {activeId !== null ? (
                <Button
                  aria-label="Delete conversation"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(activeId)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          </div>
          {conversations.data && conversations.data.length > 0 ? (
            <Select
              value={String(activeId)}
              onValueChange={(value) => setSelectedId(Number(value))}
            >
              <SelectTrigger aria-label="Research conversation" className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {conversations.data.map((conversation) => (
                    <SelectItem key={conversation.id} value={String(conversation.id)}>
                      {conversation.title ?? `${conversation.model} conversation`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
        </CardHeader>
        <CardContent>
          {conversations.isLoading || (activeId !== null && detail.isLoading) ? (
            <Skeleton className="h-[38rem]" />
          ) : detail.data ? (
            <ConversationSession key={detail.data.id} detail={detail.data} />
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                Create a conversation to ask research follow-ups for {ticker}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
