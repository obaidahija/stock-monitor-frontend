import { expect, test } from 'vitest'
import {
  companyFromFilingTitle,
  formatItemCodes,
  formatSourceName,
  formToLabel,
  humanizeLabel,
  isFormNameOnly,
} from './labels'

test('names every news source a person would recognise', () => {
  expect(formatSourceName('yahoo')).toBe('Yahoo Finance')
  expect(formatSourceName('google_news')).toBe('Google News')
  expect(formatSourceName('finviz:TIKR')).toBe('TIKR')
  expect(formatSourceName('finnhub:Yahoo')).toBe('Yahoo')
  expect(formatSourceName('finnhub:SeekingAlpha')).toBe('Seeking Alpha')
  expect(formatSourceName('finviz:GuruFocus.com')).toBe('GuruFocus')
  expect(formatSourceName('finnhub:general')).toBe('Finnhub')
  expect(formatSourceName('rss:cnbc_top_news')).toBe('CNBC')
  expect(formatSourceName('rss:wsj_markets')).toBe('WSJ Markets')
  expect(formatSourceName('rss:some_new_feed')).toBe('Some new feed')
})

test('leaves a name that is already readable alone', () => {
  expect(formatSourceName('Issuer')).toBe('Issuer')
  expect(formatSourceName('The Wall Street Journal')).toBe('The Wall Street Journal')
})

test('humanizes identifiers in sentence case', () => {
  expect(humanizeLabel('ex_dividend')).toBe('Ex dividend')
  expect(humanizeLabel('split')).toBe('Split')
})

test('names common SEC forms and leaves unknown ones unlabelled', () => {
  expect(formToLabel('4')).toBe('Insider trade')
  expect(formToLabel('144')).toBe('Planned insider sale')
  expect(formToLabel('8-K')).toBe('Current report')
  expect(formToLabel('SCHEDULE 13G/A')).toBe('Passive 5%+ stake (amended)')
  expect(formToLabel('ZZZ')).toBeNull()
})

test('turns 8-K item codes into words and hides exhibits when other items exist', () => {
  expect(formatItemCodes('2.02,7.01,9.01')).toBe('Results · Reg FD disclosure')
  expect(formatItemCodes('9.01')).toBe('Exhibits')
  expect(formatItemCodes('1.01, 4.01')).toBe('Material agreement · Auditor change')
  expect(formatItemCodes('6.03')).toBe('Item 6.03')
  expect(formatItemCodes('')).toBeNull()
  expect(formatItemCodes(null)).toBeNull()
})

test('reads the company out of an EDGAR feed title', () => {
  expect(companyFromFilingTitle('8-K - Helmerich & Payne, Inc. (0000046765) (Filer)')).toBe(
    'Helmerich & Payne, Inc.',
  )
  // A company name may itself contain " - ".
  expect(
    companyFromFilingTitle('8-K - Petróleo Brasileiro S.A. - Petrobras (0001119639) (Filer)'),
  ).toBe('Petróleo Brasileiro S.A. - Petrobras')
  expect(companyFromFilingTitle('FORM 4')).toBeNull()
  expect(companyFromFilingTitle(null)).toBeNull()
})

test('recognises a title that only repeats the form', () => {
  expect(isFormNameOnly('FORM 4', '4')).toBe(true)
  expect(isFormNameOnly(' 8-k ', '8-K')).toBe(true)
  expect(isFormNameOnly('Quarterly results', '8-K')).toBe(false)
})
