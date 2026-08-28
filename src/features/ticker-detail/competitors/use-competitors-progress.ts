import { useEffect, useState } from 'react'
import { buildWsUrl } from '@/lib/ws-client'
import type { JobProgressEvent } from '@/types/api'

/**
 * Short-lived, one-shot WS subscription to live progress for a single
 * competitor-identification run, over GET /v1/stocks/{ticker}/competitors/ws.
 * Mirrors useAiResearchProgress: connects only while `enabled` is true (a
 * generate/refresh call is in flight) and disconnects as soon as it flips
 * false -- a dropped connection is purely cosmetic, since the HTTP response
 * remains the source of truth for the final result.
 */
export function useCompetitorsProgress(ticker: string, enabled: boolean) {
  const [event, setEvent] = useState<JobProgressEvent | null>(null)

  useEffect(() => {
    if (!enabled) return
    setEvent(null)
    const socket = new WebSocket(buildWsUrl(`/v1/stocks/${ticker}/competitors/ws`))
    socket.onmessage = (message) => {
      setEvent(JSON.parse(message.data as string) as JobProgressEvent)
    }
    return () => socket.close()
  }, [ticker, enabled])

  return event
}
