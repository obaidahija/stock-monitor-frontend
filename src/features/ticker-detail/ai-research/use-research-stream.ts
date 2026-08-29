import { useCallback, useEffect, useRef, useState } from 'react'
import { streamAiConversationMessage } from '@/api/ai'
import type {
  AiConversationMessageOut,
  LlmUsageSummaryOut,
  ResearchStreamEvent,
} from '@/types/api'

const ACCEPTED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
])
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_TOTAL_BYTES = 40 * 1024 * 1024

async function filePartToFile(part: { filename?: string; mediaType?: string; url: string }) {
  const response = await fetch(part.url)
  const blob = await response.blob()
  return new File([blob], part.filename ?? 'attachment', {
    type: part.mediaType ?? blob.type,
  })
}

export function useResearchStream(conversationId: number | null) {
  const [localMessages, setLocalMessages] = useState<AiConversationMessageOut[]>([])
  const [thinking, setThinking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canRetry, setCanRetry] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastRequestRef = useRef<{
    text: string
    files: { filename?: string; mediaType?: string; url: string }[]
    includeChart: boolean
  } | null>(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const send = useCallback(
    async (request: {
      text: string
      files: { filename?: string; mediaType?: string; url: string }[]
      includeChart: boolean
    }) => {
      const {
      text,
      files,
      includeChart,
      } = request
      if (conversationId === null) throw new Error('Create a conversation first')
      lastRequestRef.current = request
      const attachments = await Promise.all(files.map(filePartToFile))
      if (attachments.some((file) => !ACCEPTED_TYPES.has(file.type))) {
        throw new Error('Only PNG, JPEG, WebP, PDF, MP4, and WebM attachments are supported.')
      }
      if (attachments.some((file) => file.size > MAX_FILE_BYTES)) {
        throw new Error('Each attachment must be 20 MiB or smaller.')
      }
      if (attachments.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
        throw new Error('Attachments must total 40 MiB or less.')
      }

      const temporaryUserId = -Date.now()
      const temporaryAssistantId = temporaryUserId - 1
      setLocalMessages((current) => [
        ...current,
        {
          id: temporaryUserId,
          role: 'user',
          content: text,
          attachment_names: attachments.map((file) => file.name),
          status: 'complete',
          created_at: new Date().toISOString(),
        },
        {
          id: temporaryAssistantId,
          role: 'assistant',
          content: '',
          attachment_names: [],
          status: 'complete',
          created_at: new Date().toISOString(),
        },
      ])
      setError(null)
      setCanRetry(false)
      setThinking(false)
      setIsStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller
      const form = new FormData()
      form.set('message', text)
      form.set('include_chart', String(includeChart))
      for (const file of attachments) form.append('attachments', file)

      let usage: LlmUsageSummaryOut | null = null
      function onEvent(event: ResearchStreamEvent) {
        if (event.event === 'thinking') setThinking(event.data.active)
        if (event.event === 'text_delta') {
          setThinking(false)
          setLocalMessages((current) =>
            current.map((message) =>
              message.id === temporaryAssistantId
                ? { ...message, content: message.content + event.data.text }
                : message,
            ),
          )
        }
        if (event.event === 'usage') usage = event.data
        if (event.event === 'completed') {
          setThinking(false)
          setLocalMessages((current) =>
            current.map((message) =>
              message.id === temporaryAssistantId
                ? { ...event.data.message, usage }
                : message,
            ),
          )
        }
        if (event.event === 'error') {
          setThinking(false)
          setError(event.data.message)
          setCanRetry(event.data.retryable)
        }
      }

      try {
        await streamAiConversationMessage(conversationId, form, controller.signal, onEvent)
      } catch (streamError) {
        if (!(streamError instanceof DOMException && streamError.name === 'AbortError')) {
          setError(streamError instanceof Error ? streamError.message : 'Research stream failed')
          setCanRetry(true)
        }
      } finally {
        setThinking(false)
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [conversationId],
  )

  const retry = useCallback(async () => {
    if (lastRequestRef.current) await send(lastRequestRef.current)
  }, [send])

  return {
    localMessages,
    thinking,
    isStreaming,
    error,
    canRetry,
    setError,
    send,
    retry,
    stop,
  }
}
