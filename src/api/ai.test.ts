import { afterEach, expect, test, vi } from 'vitest'
import { streamAiConversationMessage } from './ai'

afterEach(() => vi.restoreAllMocks())

test('parses SSE events across chunk boundaries and preserves multipart headers', async () => {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: started\ndata: {"conversation_id":7,'))
      controller.enqueue(encoder.encode('"provider":"openrouter","model":"qwen"}\n\n'))
      controller.enqueue(encoder.encode('event: text_delta\ndata: {"text":"hello"}\n\n'))
      controller.close()
    },
  })
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  )
  const eventNames: string[] = []
  const form = new FormData()
  form.set('message', 'hello')

  await streamAiConversationMessage(7, form, new AbortController().signal, (event) =>
    eventNames.push(event.event),
  )

  expect(eventNames).toEqual(['started', 'text_delta'])
  const request = fetchMock.mock.calls[0][1]
  expect(request?.body).toBe(form)
  expect(new Headers(request?.headers).has('Content-Type')).toBe(false)
})
