import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingFieldControl } from './setting-field'
import type { SettingField, SettingValue } from '@/types/api'

function field(overrides: Partial<SettingField> = {}): SettingField {
  return {
    name: 'mention_spike_min_count',
    label: 'Mention spike min count',
    kind: 'int',
    description: 'Minimum same-day mentions before a spike can be flagged.',
    value: 5,
    default: 5,
    is_overridden: false,
    requires_restart: false,
    minimum: 1,
    maximum: 100,
    ...overrides,
  }
}

/**
 * The control is controlled by its parent, so a test that pins `value` would
 * fight React on every keystroke. This harness holds the value the way the
 * real category form does.
 */
function Harness({ f, onChange }: { f: SettingField; onChange: (v: SettingValue) => void }) {
  const [value, setValue] = useState<SettingValue>(f.value)
  return (
    <SettingFieldControl
      field={f}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('SettingFieldControl', () => {
  // vitest runs without `globals`, so RTL never registers its auto-cleanup.
  afterEach(cleanup)

  it('renders the label and description', () => {
    render(<SettingFieldControl field={field()} value={5} onChange={vi.fn()} />)
    expect(screen.getByText('Mention spike min count')).toBeInTheDocument()
    expect(
      screen.getByText('Minimum same-day mentions before a spike can be flagged.'),
    ).toBeInTheDocument()
  })

  it('applies bounds to a numeric input', () => {
    render(<SettingFieldControl field={field()} value={5} onChange={vi.fn()} />)
    const input = screen.getByLabelText('Mention spike min count')
    expect(input).toHaveAttribute('min', '1')
    expect(input).toHaveAttribute('max', '100')
  })

  it('emits a number for an int field', () => {
    const onChange = vi.fn()
    render(<Harness f={field()} onChange={onChange} />)
    // fireEvent rather than userEvent.type: user-event drives a stepped
    // number input one keystroke at a time and jsdom rejects the
    // intermediate states, so nothing reaches onChange.
    fireEvent.change(screen.getByLabelText('Mention spike min count'), {
      target: { value: '9' },
    })
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  it('marks an overridden field', () => {
    render(
      <SettingFieldControl field={field({ is_overridden: true })} value={11} onChange={vi.fn()} />,
    )
    expect(screen.getByText(/overridden/i)).toBeInTheDocument()
  })

  it('warns when a field needs a restart', () => {
    render(
      <SettingFieldControl field={field({ requires_restart: true })} value={5} onChange={vi.fn()} />,
    )
    expect(screen.getByText(/applies after restart/i)).toBeInTheDocument()
  })

  it('toggles a bool field', async () => {
    const onChange = vi.fn()
    const boolField = field({
      name: 'sentiment_enabled',
      label: 'Sentiment enabled',
      kind: 'bool',
      value: true,
      default: true,
      minimum: null,
      maximum: null,
    })
    render(<Harness f={boolField} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Sentiment enabled'))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })
})
