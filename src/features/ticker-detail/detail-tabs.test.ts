import { expect, test } from 'vitest'
import { resolveDetailTab } from './detail-tabs'

const resolve = (query: string) => resolveDetailTab(new URLSearchParams(query))

test('defaults to Analysis with each tab’s default view', () => {
  expect(resolve('')).toEqual({
    tab: 'analysis',
    socialPlatform: 'twitter',
    filingsView: 'insider',
    peersView: 'competitors',
  })
})

test('reads a current tab and its view', () => {
  expect(resolve('tab=filings&view=all')).toMatchObject({ tab: 'filings', filingsView: 'all' })
  expect(resolve('tab=peers&view=pairs')).toMatchObject({ tab: 'peers', peersView: 'pairs' })
  expect(resolve('tab=social&platform=reddit')).toMatchObject({ tab: 'social', socialPlatform: 'reddit' })
})

test('maps every retired tab onto its new home', () => {
  expect(resolve('tab=catalysts').tab).toBe('earnings')
  expect(resolve('tab=competitors')).toMatchObject({ tab: 'peers', peersView: 'competitors' })
  expect(resolve('tab=pairs')).toMatchObject({ tab: 'peers', peersView: 'pairs' })
  expect(resolve('tab=insider')).toMatchObject({ tab: 'filings', filingsView: 'insider' })
  expect(resolve('tab=twitter')).toMatchObject({ tab: 'social', socialPlatform: 'twitter' })
  expect(resolve('tab=reddit')).toMatchObject({ tab: 'social', socialPlatform: 'reddit' })
})

test('falls back to defaults for unknown values', () => {
  expect(resolve('tab=nonsense').tab).toBe('analysis')
  expect(resolve('tab=filings&view=bogus').filingsView).toBe('insider')
  expect(resolve('tab=social&platform=nonsense').socialPlatform).toBe('twitter')
})

test('a retired tab wins over a stray view param', () => {
  expect(resolve('tab=pairs&view=competitors').peersView).toBe('pairs')
})
