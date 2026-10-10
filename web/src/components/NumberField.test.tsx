// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from '../state/store'
import { emptyWorkspace } from '../state/workspace'
import { NumberField, type NumberFieldProps } from './NumberField'

const UNREADABLE = 'Enter a number like 1,234.56. This workspace uses "." for decimals.'

function setup(props: Partial<NumberFieldProps> = {}) {
  const onCommit = vi.fn()
  const view = render(<NumberField label="Total" kind="currency" value="1000.00" onCommit={onCommit} {...props} />)
  const input = screen.getByLabelText('Total') as HTMLInputElement
  const type = (text: string) => fireEvent.change(input, { target: { value: text } })
  return { onCommit, input, type, view }
}

describe('NumberField (§2.4, §12.5)', () => {
  beforeEach(() => useWorkspaceStore.getState().load(emptyWorkspace('en-US')))
  afterEach(cleanup)

  it('shows the amount in the workspace locale and currency', () => {
    const { input } = setup()
    expect(input.value).toBe('1,000.00')
    expect(screen.getByRole('textbox', { description: 'US Dollar' })).toBe(input)
    expect(screen.getByText('$').getAttribute('aria-hidden')).toBe('true')
  })

  it('commits the canonical value on Enter', () => {
    const { onCommit, input, type } = setup()
    type('$2,500.5')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('2500.5')
  })

  it("doesn't commit the same amount written differently", () => {
    const { onCommit, input, type } = setup()
    type('1000')
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('keeps unreadable text with an error, and saves nothing until Escape', () => {
    const { onCommit, input, type } = setup()
    type('1.2.3')
    fireEvent.blur(input)
    expect(input.value).toBe('1.2.3')
    expect(screen.getByRole('textbox', { description: `${UNREADABLE} US Dollar` })).toBe(input)
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('1,000.00')
    expect(screen.queryByText(UNREADABLE)).toBeNull()
  })

  it('shows the parse error instead of the calc error', () => {
    const { input, type } = setup({ error: 'Total additions must be greater than zero.' })
    expect(screen.getByText('Total additions must be greater than zero.')).toBeDefined()
    type('abc')
    fireEvent.blur(input)
    expect(screen.getByText(UNREADABLE)).toBeDefined()
    expect(screen.queryByText('Total additions must be greater than zero.')).toBeNull()
  })

  it('drops the draft when the value changes elsewhere, e.g. undo', () => {
    const { input, type, view, onCommit } = setup()
    type('abc')
    fireEvent.blur(input)
    view.rerender(<NumberField label="Total" kind="currency" value="5" onCommit={onCommit} />)
    expect(input.value).toBe('5.00')
    expect(screen.queryByText(UNREADABLE)).toBeNull()
  })

  it('is read-only while another tab is the editor (§11.1)', () => {
    const { input } = setup()
    act(() => useWorkspaceStore.getState().setReadOnly(true))
    expect(input.readOnly).toBe(true)
    act(() => useWorkspaceStore.getState().setReadOnly(false))
  })

  it('uses the decimal keypad only when negatives are not allowed', () => {
    expect(setup().input.inputMode).toBe('decimal')
    cleanup()
    expect(setup({ allowNegative: true }).input.inputMode).toBe('')
  })

  it('shows percentages', () => {
    setup({ kind: 'percent', value: '85.5' })
    expect(screen.getByRole('textbox', { description: 'percent' })).toHaveProperty('value', '85.5')
  })
})
