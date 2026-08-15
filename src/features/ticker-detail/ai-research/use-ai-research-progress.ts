import { useEffect, useState } from 'react'
import { buildWsUrl } from '@/lib/ws-client'
import type { JobProgressEvent } from '@/types/api'

/**
 * Short-lived, one-shot WS subscription to live progress for a single
 * ai-research generation, over GET /v1/stocks/{ticker}/ai-research/ws.
 * Connects only while `enabled` is true (a generate/refresh call is in
 * flight) and disconnects as soon as it flips false -- unlike useJobProgress
 * (which stays open indefinitely for a persistent system dashboard widget),
 * a dropped connection here is purely cosmetic: the HTTP response remains
 * the source of truth for the final result, so the bar just freezes at its
 * last known stage until that response arrives.
 */
export function useAiResearchProgress(ticker: string, enabled: boolean) {
  const [event, setEvent] = useState<JobProgressEvent | null>(null)

  useEffect(() => {
    if (!enabled) return
    setEvent(null)
    const socket = new WebSocket(buildWsUrl(`/v1/stocks/${ticker}/ai-research/ws`))
    socket.onmessage = (message) => {
      setEvent(JSON.parse(message.data as string) as JobProgressEvent)
    }
    return () => socket.close()
  }, [ticker, enabled])

  return event
}
