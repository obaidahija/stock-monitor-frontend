import { expect, test } from 'vitest'
import { summarizeCompetitors } from './competitor-summary'

test('extracts ranked company sections and keeps only the first explanation sentence', () => {
  const result = summarizeCompetitors(`Long industry introduction.
### Direct Competitors (HDD Market)
### 1. Seagate Technology Holdings plc
- Ticker & Exchange: NASDAQ:STX
- Competing Products/Segments: Nearline HDDs.
- Explanation: Seagate competes in hard disk drives. Long technology discussion follows.
### Indirect Competitors (Storage Alternatives)
### 2. Micron Technology, Inc.
- Ticker & Exchange: NASDAQ:MU
- Explanation: Micron supplies enterprise SSDs. More industry background.
### Non-Public, Private, or Delisted Competitors
- Old Storage (NYSE:OLD): Delisted.
`, 'WDC')
  expect(result).toEqual([
    { companyName: 'Seagate Technology Holdings plc', symbols: ['STX'], group: 'direct', explanation: 'Seagate competes in hard disk drives.' },
    { companyName: 'Micron Technology, Inc.', symbols: ['MU'], group: 'indirect', explanation: 'Micron supplies enterprise SSDs.' },
  ])
})

test('handles ticker-first records without carrying the previous company name', () => {
  expect(summarizeCompetitors(`### Direct Competitors
- Ticker/Exchange: NYSE:U
- Explanation: Unity offers mobile ad mediation. Longer explanation.
- Ticker/Exchange: NASDAQ:APPS
- Explanation: Digital Turbine operates a mobile advertising platform.
### Indirect Competitors & Alternatives
- Ticker/Exchange: NASDAQ:GOOG / NASDAQ:GOOGL
- Explanation: Google is a competitor through AdMob. More details.
`, 'APP')).toEqual([
    { companyName: 'Unity', symbols: ['U'], group: 'direct', explanation: 'Unity offers mobile ad mediation.' },
    { companyName: 'Digital Turbine', symbols: ['APPS'], group: 'direct', explanation: 'Digital Turbine operates a mobile advertising platform.' },
    { companyName: 'Google', symbols: ['GOOG', 'GOOGL'], group: 'indirect', explanation: 'Google is a competitor through AdMob.' },
  ])
})

test('supports an existing inline answer and excludes the selected stock and repeated tickers', () => {
  expect(summarizeCompetitors(`Seagate (**STX**) competes in hard disk drives.
- **Seagate (NASDAQ:STX)**: Repeated mention.
- **Western Digital (NASDAQ:WDC)**: The selected stock.
`, 'wdc')).toEqual([
    { companyName: 'Seagate', symbols: ['STX'], group: 'other', explanation: 'competes in hard disk drives.' },
  ])
})

test('reads markdown tables with explicit ticker columns and preserves share classes', () => {
  expect(summarizeCompetitors(`| Company | Ticker / Exchange | Type | Explanation |
| --- | --- | --- | --- |
| Seagate | NASDAQ:STX | Direct | Makes hard disk drives. More detail. |
| Example Holdings | BRK-B | Indirect | Offers an alternative. |
`, 'WDC')).toEqual([
    { companyName: 'Seagate', symbols: ['STX'], group: 'direct', explanation: 'Makes hard disk drives.' },
    { companyName: 'Example Holdings', symbols: ['BRK.B'], group: 'indirect', explanation: 'Offers an alternative.' },
  ])
})

test('does not turn product abbreviations or source URLs into competitors', () => {
  expect(summarizeCompetitors(`Storage products (HDD) and memory (NAND) compete.
### Sources
[Research](https://example.com/NASDAQ:FAKE)
`, 'WDC')).toEqual([])
})

test('product and explanation fields with parenthesized technologies remain part of the same competitor', () => {
  expect(summarizeCompetitors(`### Direct Competitors
### Seagate Technology
- Ticker & Exchange: NASDAQ:STX
- Competing Products/Segments: Nearline HDDs (e.g., Mozaic HAMR drives), enterprise systems.
- Explanation: Seagate competes in hard disk drives (HDD) and cloud storage.
`, 'WDC')).toEqual([
    { companyName: 'Seagate Technology', symbols: ['STX'], group: 'direct', explanation: 'Seagate competes in hard disk drives (HDD) and cloud storage.' },
  ])
})

test('preserves company abbreviations inside the first sentence', () => {
  expect(summarizeCompetitors(`### Direct Competitors
- Ticker: NTAP
- Explanation: NetApp, Inc. provides enterprise storage. Extra detail.
`, 'WDC')[0].explanation).toBe('NetApp, Inc. provides enterprise storage.')
})

test('keeps unclassified answers neutral rather than inventing competitive strength', () => {
  const result = summarizeCompetitors('### Seagate (NASDAQ:STX)\nCompetes in HDDs.', 'WDC')
  expect(result[0]).toMatchObject({ symbols: ['STX'], group: 'other' })
  expect(summarizeCompetitors('No listed competitors could be confirmed.', 'WDC')).toEqual([])
})

test('retains both share classes when only the first carries the exchange prefix', () => {
  expect(summarizeCompetitors('### Indirect Competitors\n- Ticker/Exchange: NASDAQ:GOOG / GOOGL\n- Explanation: Google competes through AdMob.', 'APP')[0].symbols).toEqual(['GOOG', 'GOOGL'])
})

test('inline source references and a bold sources section never create competitor rows', () => {
  const result = summarizeCompetitors(`### Direct competitors
- Ticker: STX
- Explanation: Seagate competes in HDDs.
- Source: Alphabet (NASDAQ:GOOGL): Annual report.
**Sources**
Alphabet (NASDAQ:GOOG): Research reference.
`, 'WDC')
  expect(result.map((item) => item.symbols)).toEqual([['STX']])
})

test.each(['It competes through AdMob.', 'The company provides advertising.', 'Its advertising platform competes with AppLovin.'])('an anonymous explanation does not fabricate a company name: %s', (explanation) => {
  expect(summarizeCompetitors(`- Ticker: GOOG\n- Explanation: ${explanation}`, 'APP')[0].companyName).toBeNull()
})

test('a mixed direct-and-alternatives heading keeps the classification unspecified', () => {
  expect(summarizeCompetitors('## Direct competitors and alternatives\n### Seagate (NASDAQ:STX)\nMakes HDDs.', 'WDC')[0].group).toBe('other')
})

test('a public competitors section resumes extraction after private competitors', () => {
  expect(summarizeCompetitors(`## Private competitors
Private Storage (NYSE:OLD): No longer listed.
## Public competitors
Seagate (NASDAQ:STX) competes in HDDs.
`, 'WDC')).toEqual([
    { companyName: 'Seagate', symbols: ['STX'], group: 'other', explanation: 'competes in HDDs.' },
  ])
})
