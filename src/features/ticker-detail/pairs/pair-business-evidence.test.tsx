import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { StockPairBusinessEvidenceOut } from '@/types/api'
import { PairBusinessEvidence } from './pair-business-evidence'
import {
  checkedEvidence,
  partialEvidence,
  seagateClaim,
  unretrievedEvidence,
  westernDigitalClaim,
} from './test-fixtures'

afterEach(cleanup)

const EXPLANATION = 'Duopoly in enterprise hard drives'

function show(evidence: StockPairBusinessEvidenceOut | null) {
  return render(<PairBusinessEvidence evidence={evidence} explanation={EXPLANATION} />)
}

test('checked passages are shown apart from the connection Google proposed', () => {
  show(checkedEvidence)

  expect(screen.getByText('Source passage checked')).toBeInTheDocument()
  expect(screen.getByText(`Google Finance: ${EXPLANATION}`)).toBeInTheDocument()
  const claims = screen.getByRole('list', { name: 'Source passages' })
  const items = within(claims).getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(within(items[0]).getByText(/Seagate sells mass-capacity hard drives\./)).toBeInTheDocument()
  expect(within(items[0]).getByText('Proposed by Google Finance')).toBeInTheDocument()
  expect(within(items[0]).getByText('Found on the page')).toBeInTheDocument()
  expect(
    within(items[0]).getAllByText(/Seagate Technology is a leading provider/).length,
  ).toBeGreaterThan(0)
  // The proposed connection is never presented as part of a checked passage.
  expect(within(claims).queryByText(new RegExp(EXPLANATION))).not.toBeInTheDocument()
})

test('labels never claim a verified pair or relationship', () => {
  for (const evidence of [checkedEvidence, partialEvidence, unretrievedEvidence, null]) {
    const { container, unmount } = show(evidence)
    expect(container.textContent).not.toMatch(/verified/i)
    unmount()
  }
})

test('partial coverage says which passage was not found', () => {
  show(partialEvidence)

  expect(screen.getByText('Source passage partly checked')).toBeInTheDocument()
  expect(screen.getByText('Passages were found for only one company.')).toBeInTheDocument()
  const [, missing] = within(screen.getByRole('list', { name: 'Source passages' })).getAllByRole(
    'listitem',
  )
  expect(within(missing).getByText('Not found as quoted')).toBeInTheDocument()
  expect(
    within(missing).getByText("The quoted sentence was not found in the page's article text."),
  ).toBeInTheDocument()
  expect(within(missing).queryByText('Found on the page')).not.toBeInTheDocument()
})

test('an unretrieved source is reported as unavailable, not as contradicted', () => {
  show(unretrievedEvidence)

  expect(screen.getByText('No source passage confirmed')).toBeInTheDocument()
  expect(screen.getByText(/neither confirmed nor contradicted/)).toBeInTheDocument()
  expect(screen.getByText('Source could not be retrieved')).toBeInTheDocument()
  expect(screen.getByText('The source returned HTTP 403.')).toBeInTheDocument()
  expect(screen.queryByText(/disproved|false/i)).not.toBeInTheDocument()
})

test('a report saved before source checks says so', () => {
  show(null)

  expect(screen.getByText(`Google Finance: ${EXPLANATION}`)).toBeInTheDocument()
  expect(
    screen.getByText('Not independently checked; refresh to check sources'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Source passages' })).not.toBeInTheDocument()
})

test('only web addresses become clickable citations', () => {
  const unsafe = {
    ...checkedEvidence,
    claims: [
      { ...seagateClaim, source: { ...seagateClaim.source, url: 'javascript:alert(1)' } },
      westernDigitalClaim,
    ],
  }

  show(unsafe)

  expect(screen.queryByRole('link', { name: /Seagate investors/ })).not.toBeInTheDocument()
  expect(screen.getByText('Seagate investors')).toBeInTheDocument()
  const safe = screen.getByRole('link', { name: /About Western Digital/ })
  expect(safe).toHaveAttribute('href', 'https://www.westerndigital.com/company/about')
  expect(safe).toHaveAttribute('target', '_blank')
  expect(safe).toHaveAttribute('rel', expect.stringContaining('noopener'))
})

test('reported, published and retrieval dates are kept distinct', () => {
  show(checkedEvidence)

  const [first, second] = within(screen.getByRole('list', { name: 'Source passages' })).getAllByRole(
    'listitem',
  )
  expect(within(first).getByText(/Date reported by Google Finance/)).toHaveTextContent('Aug 1, 2026')
  expect(within(first).getByText(/Page's own publication date/)).toHaveTextContent('Jul 30, 2026')
  const retrieved = within(first).getByText(/Retrieved/)
  expect(retrieved.querySelector('time')).toHaveAttribute('datetime', '2026-10-01T12:02:00Z')
  // Dates a source did not state are not invented.
  expect(within(second).queryByText(/Date reported by Google Finance/)).not.toBeInTheDocument()
  expect(within(second).queryByText(/Page's own publication date/)).not.toBeInTheDocument()
})

test('a passage that must name both companies is labelled that way', () => {
  show({ ...checkedEvidence, claims: [{ ...seagateClaim, subject: 'BOTH', kind: 'supplier_customer' }] })

  expect(screen.getByText(/Both companies/)).toBeInTheDocument()
})
