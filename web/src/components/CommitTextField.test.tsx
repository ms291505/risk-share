// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from '../state/store'
import { CommitTextField } from './CommitTextField'

describe('CommitTextField (§12.5)', () => {
  afterEach(cleanup)

  function setup(value = 'Lisa') {
    const onCommit = vi.fn()
    const view = render(<CommitTextField label="Name" value={value} onCommit={onCommit} />)
    return { onCommit, input: screen.getByLabelText('Name') as HTMLInputElement, ...view }
  }

  it('commits once on blur, not per keystroke', () => {
    const { onCommit, input } = setup()
    fireEvent.change(input, { target: { value: 'Lis' } })
    fireEvent.change(input, { target: { value: 'Liz' } })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Liz')
  })

  it('commits on Enter and discards on Escape', () => {
    const { onCommit, input } = setup()
    fireEvent.change(input, { target: { value: 'Bob' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Bob')

    fireEvent.change(input, { target: { value: 'Bobby' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('Lisa')
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it("doesn't commit an unchanged value", () => {
    const { onCommit, input } = setup()
    fireEvent.change(input, { target: { value: 'Lisa' } })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('is read-only while another tab is the editor (§11.1)', () => {
    const { input } = setup()
    expect(input.readOnly).toBe(false)
    act(() => useWorkspaceStore.getState().setReadOnly(true))
    expect(input.readOnly).toBe(true)
    act(() => useWorkspaceStore.getState().setReadOnly(false))
    expect(input.readOnly).toBe(false)
  })

  it('shows external changes, e.g. from app undo', () => {
    const { input, rerender, onCommit } = setup()
    rerender(<CommitTextField label="Name" value="Restored" onCommit={onCommit} />)
    expect(input.value).toBe('Restored')
  })

  it('links the error to the field', () => {
    render(<CommitTextField label="Other" value="" onCommit={() => {}} error="Enter a name." />)
    expect(screen.getByLabelText('Other').getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByRole('textbox', { description: 'Enter a name.' })).toBeDefined()
  })
})
