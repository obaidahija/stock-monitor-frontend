export type CompetitorGroup = 'direct' | 'indirect' | 'other'

export interface CompetitorSummary {
  companyName: string | null
  symbols: string[]
  group: CompetitorGroup
  explanation: string
}

const NON_SYMBOLS = new Set(['NASDAQ', 'NYSE', 'AMEX', 'OTC', 'NONE', 'NA', 'NAND', 'HDD', 'SSD', 'DRAM', 'ETF'])

function plain(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\[\d+(?:[,\s-]+\d+)*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function symbol(value: string) {
  const normalized = value.replace(/^\$/, '').replace(/^([A-Z]+)-([A-Z])$/, '$1.$2')
  return /^[A-Z][A-Z0-9]{0,9}(?:\.[A-Z0-9]{1,2})?$/.test(normalized) && !NON_SYMBOLS.has(normalized)
    ? normalized
    : null
}

/** Only explicit exchange notation, ticker-labelled fields, or company parentheses. */
function symbols(value: string, labelled = false): string[] {
  const text = plain(value)
  const exchangePattern = /\b(?:NASDAQ|NYSE|AMEX|NYSEAMERICAN|OTC|OTCMKTS)\s*:\s*([A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)?)/g
  const raw = labelled
    ? text.replace(exchangePattern, '$1').split(/\b(?:note|formerly|previously|private|delisted)\b/i)[0].split(/[\s/,;()]+/)
    : [...text.matchAll(exchangePattern)].map((match) => match[1])
  return [...new Set(raw.map(symbol).filter((item): item is string => item !== null))]
}

function groupOf(text: string): CompetitorGroup | null {
  const direct = /\bdirect\b/i.test(text)
  const indirect = /\bindirect\b|\balternatives?\b/i.test(text)
  if (direct && indirect) return 'other'
  if (indirect) return 'indirect'
  if (direct) return 'direct'
  if (/\b(?:public|other|listed|additional)\s+competitors\b/i.test(text)) return 'other'
  return null
}

/** A source excerpt, not an AI rewrite. Abbreviations do not end the sentence. */
function firstSentence(value: string) {
  const text = plain(value).replace(/^[:;—–-]+\s*/, '')
  let end = text.length
  for (const match of text.matchAll(/[.!?](?=\s|$)/g)) {
    const prefix = text.slice(0, match.index)
    if (match[0] === '.' && /\b(?:Inc|Ltd|Corp|Co|plc|vs|U\.S)$/i.test(prefix)) continue
    end = match.index + 1
    break
  }
  const sentence = text.slice(0, end).trim()
  if (sentence.length <= 220) return sentence
  return `${sentence.slice(0, 217).replace(/\s+\S*$/, '').trimEnd()}…`
}

function nameFromExplanation(text: string) {
  const name = text.match(/^(.{1,100}?)\s+(?:is|are|offers|operates|competes|provides|manufactures|designs|develops|produces|supplies|targets)\b/i)?.[1] ?? null
  return name && !/^(?:it|its|they|their|this|that|these|those|the company|the platform|the business|the provider)\b/i.test(name) ? name : null
}

/**
 * Compact existing free-form research without changing the saved answer. Recognize
 * explicit ticker records, company headings/parentheses, and labelled tables.
 * Unrecognized prose is left for the full-research disclosure; never guess symbols
 * from arbitrary capitalized words or claim an unspecified competitive category.
 */
export function summarizeCompetitors(markdown: string, selectedTicker: string): CompetitorSummary[] {
  const selected = symbol(selectedTicker.toUpperCase()) ?? selectedTicker.toUpperCase()
  const items: CompetitorSummary[] = []
  const seen = new Set<string>()
  let group: CompetitorGroup = 'other'
  let excludedSection = false
  let headingName: string | null = null
  let draft: (CompetitorSummary & { products: string }) | null = null
  let tableHeaders: string[] = []

  function add(item: CompetitorSummary) {
    const unique = item.symbols.filter((ticker) => ticker !== selected && !seen.has(ticker))
    if (unique.length === 0) return
    unique.forEach((ticker) => seen.add(ticker))
    items.push({ ...item, symbols: unique })
  }

  function flush() {
    if (draft) {
      const explanation = firstSentence(draft.explanation || draft.products)
      add({
        companyName: draft.companyName || nameFromExplanation(explanation),
        symbols: draft.symbols,
        group: draft.group,
        explanation,
      })
      draft = null
    }
  }

  for (const raw of markdown.split(/\r?\n/)) {
    const heading = raw.match(/^\s{0,3}#{1,6}\s+(.+)/)
    const line = plain(heading ? heading[1] : raw).replace(/^(?:[-+]\s+|\d+[.)]\s*)/, '')
    if (!line) continue
    if (/^sources?(?:\s+(?:links?|references?))?\s*:?$/i.test(line)) {
      flush()
      headingName = null
      excludedSection = true
      continue
    }
    if (/^sources?(?:\s+(?:links?|references?))?\s*:/i.test(line)) continue
    if (heading) {
      flush()
      headingName = null
      tableHeaders = []
      if (/\bprivate\b|\bdelisted\b|\bnon[- ]public\b|\bsubsidiar(?:y|ies)\b|^sources?\b/i.test(line)) {
        excludedSection = true
        continue
      }
      const category = groupOf(line)
      if (category) {
        group = category
        excludedSection = false
        continue
      }
      if (!excludedSection) headingName = line
    }
    if (excludedSection) continue

    if (raw.trim().startsWith('|')) {
      const cells = raw.trim().replace(/^\||\|$/g, '').split('|').map(plain)
      if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue
      if (cells.some((cell) => /\bticker\b|\bsymbol\b/i.test(cell))) {
        flush()
        tableHeaders = cells
        continue
      }
      const tickerColumn = tableHeaders.findIndex((cell) => /\bticker\b|\bsymbol\b/i.test(cell))
      if (tickerColumn < 0) continue
      const nameColumn = tableHeaders.findIndex((cell) => /company|competitor|name/i.test(cell))
      const explanationColumn = tableHeaders.findIndex((cell) => /explanation|reason|overlap|products?|segments?/i.test(cell))
      const groupColumn = tableHeaders.findIndex((cell) => /^(?:type|category|relationship)$/i.test(cell))
      if (groupColumn >= 0 && /private|delisted|subsidiary/i.test(cells[groupColumn] ?? '')) continue
      add({
        companyName: cells[nameColumn] || null,
        symbols: symbols(cells[tickerColumn] ?? '', true),
        group: groupOf(cells[groupColumn] ?? '') ?? group,
        explanation: firstSentence(cells[explanationColumn] ?? ''),
      })
      continue
    }

    const tickerField = line.match(/^(?:ticker(?:\s*(?:&|\/|and)\s*exchange)?|(?:stock\s+)?symbol)\s*:\s*(.+)/i)
    if (tickerField) {
      flush()
      draft = { companyName: headingName, symbols: symbols(tickerField[1], true), group, explanation: '', products: '' }
      headingName = null
      continue
    }
    const explanation = line.match(/^(?:explanation|reason|competitive overlap)\s*:\s*(.+)/i)
    const products = line.match(/^(?:competing\s+)?(?:products(?:\s*\/\s*segments)?|segments?)\s*:\s*(.+)/i)
    if (explanation || products) {
      if (draft && explanation) draft.explanation = explanation[1]
      if (draft && products) draft.products = products[1]
      continue
    }
    const inline = line.match(/^(.{1,100}?)\(([^)]+)\)(.*)$/)
    const inlineSymbols = inline ? symbols(inline[2], true) : []
    if (inline && inlineSymbols.length) {
      flush()
      draft = { companyName: inline[1].trim(), symbols: inlineSymbols, group, explanation: inline[3].trim(), products: '' }
      headingName = null
      continue
    }
    if (draft && !heading) {
      if (!draft.explanation && !/^(?:source|ticker|exchange)\b/i.test(line)) draft.explanation = line
    }
  }
  flush()
  return items
}
