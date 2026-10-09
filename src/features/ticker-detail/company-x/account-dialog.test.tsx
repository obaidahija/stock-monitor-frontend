import { useState } from 'react'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getTwitterOperation } from '@/api/twitter'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  confirmCompanyAccount,
  getCompanyAccount,
  saveCompanyAccount,
  validateCompanyAccount,
} from '@/api/twitter-company'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/render'
import type { CompanyAccountOut } from '@/types/twitter-company'
import { CompanyAccountDialog } from './account-dialog'
import { useCompanyAccount } from './hooks'
import { companyAccount, twitterOperation } from './test-fixtures'

vi.mock('@/api/twitter', () => ({ getTwitterOperation: vi.fn() }))
vi.mock('@/api/twitter-company', () => ({
  getCompanyAccount: vi.fn(),
  getCompanyPosts: vi.fn(),
  saveCompanyAccount: vi.fn(),
  confirmCompanyAccount: vi.fn(),
  removeCompanyAccount: vi.fn(),
  validateCompanyAccount: vi.fn(),
  ensureCompanyPosts: vi.fn(),
  refreshCompanyPosts: vi.fn(),
}))

let directory: CompanyAccountOut

beforeEach(() => {
  directory = companyAccount({
    mapping_revision: 2,
    username: 'Google',
    confirmation_state: 'unverified',
    confirmation_basis: null,
    confirmed_at: null,
    account_type: 'brand',
    candidates: [
      {
        handle: 'GoogleLead',
        source_url: 'http://www.wikidata.org/entity/Q95',
        evidence_type: 'wikidata_discovery_only',
        company_name: 'Google',
        account_type: null,
        excluded: false,
        notes: null,
      },
    ],
  })
  vi.mocked(getCompanyAccount).mockImplementation(async () => directory)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Mirrors the section: the dialog always receives the latest directory read. */
function Harness() {
  const [open, setOpen] = useState(true)
  const { data } = useCompanyAccount('GOOG')
  if (!data) return null
  return <CompanyAccountDialog ticker="GOOG" account={data} open={open} onOpenChange={setOpen} />
}

async function openDialog() {
  renderWithProviders(<Harness />)
  return screen.findByRole('dialog')
}

test('the form is labelled, focused and prefilled with the current selection', async () => {
  const dialog = await openDialog()
  const handle = within(dialog).getByLabelText('X account')
  expect(handle).toHaveValue('Google')
  expect(handle).toHaveFocus()
  expect(within(dialog).getByLabelText('Company source link (optional)')).toHaveValue('')
  expect(within(dialog).getByRole('combobox', { name: 'Account type' })).toHaveTextContent(
    'Brand/subsidiary',
  )
  expect(within(dialog).getByText(/GOOG/)).toBeVisible()
  expect(within(dialog).getByRole('link', { name: 'x.com/Google' })).toHaveAttribute(
    'href',
    'https://x.com/Google',
  )
})

test('Save for review never confirms', async () => {
  const user = userEvent.setup()
  vi.mocked(saveCompanyAccount).mockResolvedValue(directory)
  const dialog = await openDialog()

  await user.clear(within(dialog).getByLabelText('X account'))
  await user.type(within(dialog).getByLabelText('X account'), 'https://x.com/GoogleNews')
  await user.type(
    within(dialog).getByLabelText('Company source link (optional)'),
    'https://blog.google/',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Save for review' }))

  await waitFor(() =>
    expect(saveCompanyAccount).toHaveBeenCalledWith('GOOG', {
      selection: 'https://x.com/GoogleNews',
      account_type: 'brand',
      source_urls: ['https://blog.google/'],
      expected_revision: 2,
      confirm_account: false,
    }),
  )
  expect(confirmCompanyAccount).not.toHaveBeenCalled()
})

test('Save and confirm states what the user confirms and sends an explicit true', async () => {
  const user = userEvent.setup()
  vi.mocked(saveCompanyAccount).mockResolvedValue({ ...directory, confirmation_state: 'confirmed' })
  const dialog = await openDialog()

  expect(
    within(dialog).getByText(
      'Save and confirm means you confirm @Google is the X account to use for Alphabet Inc.',
    ),
  ).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Save and confirm' }))

  await waitFor(() =>
    expect(saveCompanyAccount).toHaveBeenCalledWith(
      'GOOG',
      expect.objectContaining({ selection: 'Google', expected_revision: 2, confirm_account: true }),
    ),
  )
})

test('choosing a lead only fills the form; it is never labelled official', async () => {
  const user = userEvent.setup()
  const dialog = await openDialog()
  expect(within(dialog).queryByText(/official/i)).not.toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Use @GoogleLead' }))
  expect(within(dialog).getByLabelText('X account')).toHaveValue('GoogleLead')
  expect(saveCompanyAccount).not.toHaveBeenCalled()
})

test('an unsafe source link is rejected before anything is sent', async () => {
  const user = userEvent.setup()
  const dialog = await openDialog()
  await user.type(
    within(dialog).getByLabelText('Company source link (optional)'),
    'javascript:alert(1)',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Save for review' }))
  expect(await within(dialog).findByText('Enter a full http:// or https:// link.')).toBeVisible()
  expect(saveCompanyAccount).not.toHaveBeenCalled()
})

test('a stale dialog keeps the input, reloads the directory and asks for review', async () => {
  const user = userEvent.setup()
  vi.mocked(saveCompanyAccount).mockImplementation(async () => {
    directory = { ...directory, mapping_revision: 3, username: 'Alphabet' }
    throw new ApiError(409, {
      code: 'revision_conflict',
      message: 'The company account changed. Review the current selection.',
      current_revision: 3,
    })
  })
  const dialog = await openDialog()
  await user.clear(within(dialog).getByLabelText('X account'))
  await user.type(within(dialog).getByLabelText('X account'), 'GoogleNews')
  await user.click(within(dialog).getByRole('button', { name: 'Save and confirm' }))

  expect(
    await within(dialog).findByText(
      'This account changed while you were editing. Review the current selection before saving again.',
    ),
  ).toBeVisible()
  expect(within(dialog).getByLabelText('X account')).toHaveValue('GoogleNews')
  await waitFor(() => expect(getCompanyAccount).toHaveBeenCalledTimes(2))
  expect(await within(dialog).findByText(/Current selection: @Alphabet/)).toBeVisible()

  vi.mocked(saveCompanyAccount).mockResolvedValue(directory)
  await user.click(within(dialog).getByRole('button', { name: 'Review current selection' }))
  await user.click(within(dialog).getByRole('button', { name: 'Save for review' }))
  await waitFor(() =>
    expect(saveCompanyAccount).toHaveBeenLastCalledWith(
      'GOOG',
      expect.objectContaining({ selection: 'GoogleNews', expected_revision: 3 }),
    ),
  )
})

test('checking the saved profile is a metadata preview that cannot confirm', async () => {
  const user = userEvent.setup()
  vi.mocked(validateCompanyAccount).mockResolvedValue(
    twitterOperation('lookup-1', 'queued', 'company_account_validate'),
  )
  const dialog = await openDialog()
  expect(
    within(dialog).getByText('Checking the profile looks it up on X. It does not confirm the account.'),
  ).toBeVisible()

  await user.click(within(dialog).getByRole('button', { name: 'Check profile' }))
  await waitFor(() => expect(validateCompanyAccount).toHaveBeenCalledWith('GOOG', 2))
  expect(confirmCompanyAccount).not.toHaveBeenCalled()
  expect(saveCompanyAccount).not.toHaveBeenCalled()
})

test('a fetched profile is shown for review', async () => {
  directory = {
    ...directory,
    profile: {
      name: 'Google',
      username: 'Google',
      bio: 'Organizing the world',
      profile_image_url: 'https://pbs.twimg.com/google.jpg',
    },
  }
  const dialog = await openDialog()
  expect(within(dialog).getByText('Organizing the world')).toBeVisible()
})

test('invalid input from the server is explained in place', async () => {
  const user = userEvent.setup()
  vi.mocked(saveCompanyAccount).mockRejectedValue(
    new ApiError(422, {
      code: 'invalid_account',
      message: 'Enter an X handle (@name) or an x.com profile URL.',
    }),
  )
  const dialog = await openDialog()
  await user.clear(within(dialog).getByLabelText('X account'))
  await user.type(within(dialog).getByLabelText('X account'), 'https://x.com/Google/status/1')
  await user.click(within(dialog).getByRole('button', { name: 'Save for review' }))
  expect(
    await within(dialog).findByText('Enter an X handle (@name) or an x.com profile URL.'),
  ).toBeVisible()
})

test('a draft cannot silently adopt a newer revision from live directory props', async () => {
  const user = userEvent.setup()
  const initial = directory
  const view = renderWithProviders(
    <CompanyAccountDialog ticker="GOOG" account={initial} open onOpenChange={() => {}} />,
  )
  await user.clear(screen.getByLabelText('X account'))
  await user.type(screen.getByLabelText('X account'), 'MyReplacement')
  const updated = companyAccount({ mapping_revision: 3, username: 'Alphabet' })
  view.rerender(<CompanyAccountDialog ticker="GOOG" account={updated} open onOpenChange={() => {}} />)
  expect(screen.getByText(/changed while you were editing/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Save and confirm' })).toBeDisabled()
  expect(saveCompanyAccount).not.toHaveBeenCalled()
  expect(screen.getByLabelText('X account')).toHaveValue('MyReplacement')
  await user.click(screen.getByRole('button', { name: 'Review current selection' }))
  vi.mocked(saveCompanyAccount).mockResolvedValue(updated)
  await user.click(screen.getByRole('button', { name: 'Save and confirm' }))
  await waitFor(() => expect(saveCompanyAccount).toHaveBeenCalledWith('GOOG', expect.objectContaining({
    selection: 'MyReplacement', expected_revision: 3, confirm_account: true,
  })))
})

test('a metadata request failure is explained in the review dialog', async () => {
  const user = userEvent.setup()
  vi.mocked(validateCompanyAccount).mockRejectedValue(new Error('Profile lookup failed'))
  const dialog = await openDialog()
  await user.click(within(dialog).getByRole('button', { name: 'Check profile' }))
  expect(await within(dialog).findByText('Profile lookup failed')).toBeVisible()
})

test('a metadata polling failure is visible and retries only the operation read', async () => {
  const user = userEvent.setup()
  vi.mocked(validateCompanyAccount).mockResolvedValue(
    twitterOperation('profile-poll', 'running', 'company_account_validate'),
  )
  vi.mocked(getTwitterOperation).mockRejectedValue(new Error('Profile status failed'))
  const dialog = await openDialog()
  await user.click(within(dialog).getByRole('button', { name: 'Check profile' }))
  expect(await within(dialog).findByText('Profile status failed')).toBeVisible()
  vi.mocked(getTwitterOperation).mockResolvedValue(twitterOperation('profile-poll', 'running'))
  const reads = vi.mocked(getTwitterOperation).mock.calls.length
  await user.click(within(dialog).getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(vi.mocked(getTwitterOperation).mock.calls.length).toBeGreaterThan(reads))
  expect(validateCompanyAccount).toHaveBeenCalledTimes(1)
})
