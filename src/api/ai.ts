import { ApiError, apiClient, apiFetch } from '@/lib/api-client'
import type {
  AiConversationOut,
  AiConversationSummaryOut,
  AiSettingsOut,
  AiSettingsUpdate,
  OpenRouterModelOut,
  ResearchStreamEvent,
} from '@/types/api'

export function getAiSettings() {
  return apiClient.get<AiSettingsOut>('/v1/ai/settings')
}

export function updateAiSettings(settings: AiSettingsUpdate) {
  return apiClient.put<AiSettingsOut>('/v1/ai/settings', settings)
}

export function getOpenRouterModels() {
  return apiClient.get<OpenRouterModelOut[]>('/v1/ai/models/openrouter')
}

export function createAiConversation(ticker: string) {
  return apiClient.post<AiConversationSummaryOut>(
    `/v1/stocks/${encodeURIComponent(ticker)}/ai-conversations`,
    {},
  )
}

export function listAiConversations(ticker: string) {
  return apiClient.get<AiConversationSummaryOut[]>(
    `/v1/stocks/${encodeURIComponent(ticker)}/ai-conversations`,
  )
}

export function getAiConversation(conversationId: number) {
  return apiClient.get<AiConversationOut>(`/v1/ai-conversations/${conversationId}`)
}

export function deleteAiConversation(conversationId: number) {
  return apiClient.delete<void>(`/v1/ai-conversations/${conversationId}`)
}

function parseEvent(block: string): ResearchStreamEvent | null {
  let event = ''
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (!event || dataLines.length === 0) return null
  return { event, data: JSON.parse(dataLines.join('\n')) } as ResearchStreamEvent
}

export async function streamAiConversationMessage(
  conversationId: number,
  form: FormData,
  signal: AbortSignal,
  onEvent: (event: ResearchStreamEvent) => void,
) {
  const response = await apiFetch(`/v1/ai-conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    body: form,
    signal,
  })
  if (!response.ok) {
    let detail: unknown = null
    try {
      const body = await response.json()
      detail = body?.detail ?? body
    } catch {
      detail = response.statusText
    }
    throw new ApiError(response.status, detail)
  }
  if (!response.body) throw new Error('Streaming response body is unavailable')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const event = parseEvent(buffer.slice(0, boundary))
      buffer = buffer.slice(boundary + 2)
      if (event) onEvent(event)
      boundary = buffer.indexOf('\n\n')
    }
    if (done) break
  }
  const finalEvent = parseEvent(buffer.trim())
  if (finalEvent) onEvent(finalEvent)
}
