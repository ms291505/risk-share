// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUndoShortcuts } from './useUndoShortcuts'

const onUndo = vi.fn()
const onRedo = vi.fn()

function Harness({ children }: { children?: React.ReactNode }) {
  useUndoShortcuts(onUndo, onRedo)
  return <>{children}</>
}

function setup(children?: React.ReactNode) {
  return render(<Harness>{children}</Harness>)
}

describe('useUndoShortcuts (§12.1–12.2)', () => {
  beforeEach(() => {
    onUndo.mockClear()
    onRedo.mockClear()
  })
  afterEach(cleanup)

  it('maps Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y', () => {
    setup()
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'Z', metaKey: true, shiftKey: true })
    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'y', metaKey: true })
    expect(onUndo).toHaveBeenCalledTimes(2)
    expect(onRedo).toHaveBeenCalledTimes(2)
  })

  it('ignores plain keys and Alt combinations', () => {
    setup()
    fireEvent.keyDown(document.body, { key: 'z' })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, altKey: true })
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('uses the physical key on non-Latin layouts', () => {
    setup()
    fireEvent.keyDown(document.body, { key: 'я', code: 'KeyZ', ctrlKey: true })
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('follows the letter on Latin layouts like Dvorak', () => {
    setup()
    // On Dvorak, the key labeled Z sits where QWERTY has '/'.
    fireEvent.keyDown(document.body, { key: 'z', code: 'Slash', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: ';', code: 'KeyZ', ctrlKey: true })
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('leaves text-entry fields to native undo', () => {
    const { getByLabelText } = setup(
      <>
        <input aria-label="text" />
        <input aria-label="number" type="number" />
        <textarea aria-label="area" />
      </>,
    )
    for (const label of ['text', 'number', 'area']) {
      fireEvent.keyDown(getByLabelText(label), { key: 'z', ctrlKey: true })
    }
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('still undoes from checkboxes and radios', () => {
    const { getByLabelText } = setup(
      <>
        <input aria-label="check" type="checkbox" />
        <input aria-label="radio" type="radio" />
      </>,
    )
    fireEvent.keyDown(getByLabelText('check'), { key: 'z', ctrlKey: true })
    fireEvent.keyDown(getByLabelText('radio'), { key: 'z', ctrlKey: true })
    expect(onUndo).toHaveBeenCalledTimes(2)
  })

  it('is off while a modal dialog is open', () => {
    setup(<div role="dialog" aria-modal="true" />)
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(onUndo).not.toHaveBeenCalled()
  })
})
