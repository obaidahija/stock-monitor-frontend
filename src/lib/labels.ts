/** "ex_dividend" -> "Ex dividend". */
export function humanizeLabel(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// The `source` ids news_ingest and macro_news_ingest store.
const SOURCE_NAMES: Record<string, string> = {
  yahoo: 'Yahoo Finance',
  google_news: 'Google News',
  'finnhub:general': 'Finnhub',
  'finnhub:forex': 'Finnhub forex',
  'rss:cnbc_top_news': 'CNBC',
  'rss:wsj_markets': 'WSJ Markets',
  'rss:federal_reserve': 'Federal Reserve',
  'rss:eia_energy': 'EIA',
}

// Publisher names Finviz and Finnhub spell differently from the publisher itself.
const PUBLISHER_NAMES: Record<string, string> = {
  SeekingAlpha: 'Seeking Alpha',
  'GuruFocus.com': 'GuruFocus',
  'Barrons.com': "Barron's",
}

export function formatSourceName(source: string): string {
  const known = SOURCE_NAMES[source]
  if (known) return known
  const relayed = /^(finviz|finnhub):(.+)$/.exec(source)
  if (relayed) return PUBLISHER_NAMES[relayed[2]] ?? relayed[2]
  if (source.startsWith('rss:')) return humanizeLabel(source.slice(4))
  return source.includes('_') ? humanizeLabel(source) : source
}

const FORM_LABELS: Record<string, string> = {
  '3': 'Initial insider holdings',
  '4': 'Insider trade',
  '4/A': 'Insider trade (amended)',
  '144': 'Planned insider sale',
  '8-K': 'Current report',
  '8-K/A': 'Current report (amended)',
  '10-Q': 'Quarterly report',
  '10-K': 'Annual report',
  '6-K': 'Foreign current report',
  'SCHEDULE 13G': 'Passive 5%+ stake',
  'SCHEDULE 13G/A': 'Passive 5%+ stake (amended)',
  'SCHEDULE 13D': 'Active 5%+ stake',
  'SCHEDULE 13D/A': 'Active 5%+ stake (amended)',
  'SC 13G': 'Passive 5%+ stake',
  'SC 13G/A': 'Passive 5%+ stake (amended)',
  'SC 13D': 'Active 5%+ stake',
  'SC 13D/A': 'Active 5%+ stake (amended)',
  '424B2': 'Prospectus',
  '424B3': 'Prospectus',
  '424B5': 'Prospectus',
  FWP: 'Free writing prospectus',
  '425': 'Merger communication',
  'S-8': 'Employee stock plan',
  'S-8 POS': 'Employee stock plan',
  'DEF 14A': 'Proxy statement',
  DEFA14A: 'Proxy statement',
  '13F-HR': 'Institutional holdings',
  'S-3ASR': 'Shelf registration',
}

/** Plain words for an SEC form code, or null when there is no common name for it. */
export function formToLabel(form: string): string | null {
  return FORM_LABELS[form.trim().toUpperCase()] ?? null
}

const ITEM_LABELS: Record<string, string> = {
  '1.01': 'Material agreement',
  '1.02': 'Agreement terminated',
  '1.03': 'Bankruptcy',
  '1.05': 'Cybersecurity incident',
  '2.01': 'Acquisition or disposal completed',
  '2.02': 'Results',
  '2.03': 'New debt obligation',
  '2.04': 'Debt acceleration',
  '2.05': 'Restructuring costs',
  '2.06': 'Impairment',
  '3.01': 'Delisting notice',
  '3.02': 'Unregistered share sale',
  '3.03': 'Shareholder rights change',
  '4.01': 'Auditor change',
  '4.02': 'Restatement',
  '5.01': 'Change in control',
  '5.02': 'Officer/director change',
  '5.03': 'Bylaws amended',
  '5.07': 'Shareholder vote',
  '7.01': 'Reg FD disclosure',
  '8.01': 'Other events',
  '9.01': 'Exhibits',
}

// Item 9.01 accompanies almost every 8-K; it is only news when it is the whole filing.
const EXHIBITS_ITEM = '9.01'

/** "2.02,7.01,9.01" -> "Results · Reg FD disclosure". The codes name a topic, not its effect. */
export function formatItemCodes(codes: string | null | undefined): string | null {
  const list = (codes ?? '').split(',').map((code) => code.trim()).filter(Boolean)
  if (list.length === 0) return null
  const shown = list.length > 1 ? list.filter((code) => code !== EXHIBITS_ITEM) : list
  return shown.map((code) => ITEM_LABELS[code] ?? `Item ${code}`).join(' · ')
}

// EDGAR's current-events feed titles a filing "<form> - <Company> (<10-digit CIK>) (<role>)".
// The lazy first group stops at the first " - ", so a company name containing one survives.
const FEED_TITLE = /^.+? - (.+) \(\d{10}\) \([^)]+\)$/

export function companyFromFilingTitle(title: string | null | undefined): string | null {
  if (!title) return null
  const match = FEED_TITLE.exec(title.trim())
  return match ? match[1] : null
}

/** True when a stored title only repeats the form ("FORM 4" for a Form 4). */
export function isFormNameOnly(title: string, form: string): boolean {
  const normalized = title.trim().toUpperCase()
  const code = form.trim().toUpperCase()
  return normalized === code || normalized === `FORM ${code}`
}
