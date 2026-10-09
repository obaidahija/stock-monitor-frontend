import { classifyEarningsEvent } from '@/lib/earnings-colors'
import type { EarningsEventOut, EarningsResult, YfEarningsEventOut } from '@/types/api'

export type TrackRecordSource = 'finnhub' | 'yahoo'

export interface TrackRecordQuarter {
  key: string
  eventDate: string
  result: EarningsResult
  surprisePct: number | null
}

export interface TrackRecord {
  source: TrackRecordSource
  /** Newest first. */
  quarters: TrackRecordQuarter[]
  beats: number
  beatRatePct: number
  avgSurprisePct: number
  streak: number
}

// The window the EPS history chart draws (eps-trend-chart.tsx's MAX_QUARTERS),
// so the track record describes the quarters on screen.
const YAHOO_MAX_QUARTERS = 12

type EpsRow = Pick<YfEarningsEventOut, 'event_date' | 'eps_actual' | 'eps_estimate'>

function classifiedNewestFirst(rows: EpsRow[]): TrackRecordQuarter[] {
  return rows
    .map((row) => ({
      key: row.event_date,
      eventDate: row.event_date,
      ...classifyEarningsEvent(row),
    }))
    .filter((quarter): quarter is TrackRecordQuarter => quarter.result !== null)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
}

function summarize(source: TrackRecordSource, quarters: TrackRecordQuarter[]): TrackRecord | null {
  if (quarters.length === 0) return null
  const beats = quarters.filter((quarter) => quarter.result === 'beat').length
  const surprises = quarters
    .map((quarter) => quarter.surprisePct)
    .filter((pct): pct is number => pct !== null)
  const avgSurprisePct = surprises.length
    ? surprises.reduce((sum, pct) => sum + pct, 0) / surprises.length
    : 0
  let streak = 0
  for (const quarter of quarters) {
    if (quarter.result !== 'beat') break
    streak += 1
  }
  return { source, quarters, beats, beatRatePct: (beats / quarters.length) * 100, avgSurprisePct, streak }
}

/**
 * Beat rate, surprise and streak from whichever source holds more classified
 * quarters. Finnhub's history is often a single quarter while Yahoo's carries
 * about twelve; the label names the source so the numbers stay honest.
 */
export function chooseTrackRecord(
  history: EarningsEventOut[],
  yahoo: YfEarningsEventOut[],
): TrackRecord | null {
  const yahooWindow = [...yahoo]
    .filter((row) => row.eps_estimate !== null || row.eps_actual !== null)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(-YAHOO_MAX_QUARTERS)
  const finnhubQuarters = classifiedNewestFirst(history)
  const yahooQuarters = classifiedNewestFirst(yahooWindow)
  return yahooQuarters.length > finnhubQuarters.length
    ? summarize('yahoo', yahooQuarters)
    : summarize('finnhub', finnhubQuarters)
}
