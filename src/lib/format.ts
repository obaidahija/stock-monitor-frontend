// RSS-sourced summaries (Google News, Yahoo Finance) often carry raw HTML
// markup (<a>, <font>, &nbsp;) in what's meant to be a plain-text field.
export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatSignedPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 })
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
// Below this, every digit is still easy to read; above it, "1.08M" reads faster than "1,082,683".
const COMPACT_FROM = 100_000

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return Math.abs(value) >= COMPACT_FROM ? COMPACT.format(value) : WHOLE.format(value)
}

/** A dollar total ("$968M", "-$968M"); `signed` marks positives with "+" for net figures. */
export function formatMoneyAmount(
  value: number | null | undefined,
  options: { signed?: boolean } = {},
): string {
  if (value === null || value === undefined) return '—'
  const sign = value < 0 ? '-' : options.signed && value > 0 ? '+' : ''
  return `${sign}$${formatCompactNumber(Math.abs(value))}`
}

export function formatSurprisePct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const magnitude = Math.abs(value)
  return magnitude >= 100 ? `${sign}${WHOLE.format(magnitude)}%` : `${sign}${magnitude.toFixed(1)}%`
}

export function formatScore(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // value is a plain calendar date ("YYYY-MM-DD", no time/timezone --
  // backend Pydantic `date` fields serialize this way). `new Date(value)`
  // parses that as UTC midnight, so toLocaleDateString in any timezone
  // behind UTC (e.g. America/Vancouver) rolls it back a day. Parse the
  // components directly into a local-timezone Date instead so the
  // calendar date displayed always matches the one the backend sent.
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Newer ICU builds put a narrow no-break space before AM/PM; copy and tests expect a plain space.
function plainSpaces(text: string): string {
  return text.replace(/\u202f/g, ' ')
}

const EASTERN = 'America/New_York'
const EASTERN_DATE_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const EASTERN_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})
const EASTERN_DATE_TIME_YEAR = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const EASTERN_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  hour: 'numeric',
  minute: '2-digit',
})
const EASTERN_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, hour: 'numeric' })
const EASTERN_YMD = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const UTC_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})
const UTC_MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
})

export function formatEasternDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return `${plainSpaces(EASTERN_DATE_TIME.format(new Date(value)))} ET`
}

/** A saved instant that may be months old, so the year is part of it: "Oct 7, 2026, 1:27 PM ET". */
export function formatEasternDateTimeWithYear(value: string | null | undefined): string {
  if (!value) return '—'
  return `${plainSpaces(EASTERN_DATE_TIME_YEAR.format(new Date(value)))} ET`
}

export function formatEasternDate(value: string | null | undefined): string {
  if (!value) return '—'
  return plainSpaces(EASTERN_DATE.format(new Date(value)))
}

export function formatEasternTime(value: string | null | undefined): string {
  if (!value) return '—'
  return `${plainSpaces(EASTERN_TIME.format(new Date(value)))} ET`
}

export function formatEasternHour(value: string | null | undefined): string {
  if (!value) return '—'
  return `${plainSpaces(EASTERN_HOUR.format(new Date(value)))} ET`
}

/** A chart bucket's calendar day. The bucket start is a UTC instant, so its UTC date is the day it covers. */
export function formatBucketDay(value: string | null | undefined): string {
  if (!value) return '—'
  return UTC_MONTH_DAY.format(new Date(value))
}

// Per-ticker EDGAR filings carry only a date, which the API encodes as midnight UTC.
// EDGAR accepts filings until 22:00 ET, so a real acceptance time never lands exactly here.
const MIDNIGHT_UTC = /T00:00(:00(\.0+)?)?(Z|\+00:00)$/

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  if (MIDNIGHT_UTC.test(value)) return UTC_DATE.format(new Date(value))
  return formatEasternDateTime(value)
}

/** Calendar days from today in New York to `dateString` ("YYYY-MM-DD"); 0 means today. */
export function easternDaysUntil(dateString: string, now: Date = new Date()): number {
  const parts = EASTERN_YMD.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value)
  // Compare calendar dates on a UTC axis so DST cannot add or remove an hour.
  const today = Date.UTC(part('year'), part('month') - 1, part('day'))
  const [year, month, day] = dateString.split('-').map(Number)
  return Math.round((Date.UTC(year, month - 1, day) - today) / 86_400_000)
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  const now = Date.now()
  const diffSeconds = Math.round((now - then) / 1000)

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
      return rtf.format(Math.round(-diffSeconds / secondsInUnit), unit)
    }
  }
  return 'just now'
}

/** 82 -> "82nd". The teens are the exception to the last-digit rule
 * (11th/12th/13th, not 11st/12nd/13rd), so they are checked first. */
export function formatOrdinal(value: number): string {
  const n = Math.round(value)
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
