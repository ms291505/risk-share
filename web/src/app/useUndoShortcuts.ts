import { useEffect } from 'react'

/** Fields with their own native undo (§12.2). Checkboxes, radios and other non-text inputs aren't included. */
const TEXT_ENTRY = [
  'input:not([type])',
  ...['text', 'search', 'email', 'url', 'tel', 'password', 'number'].map((t) => `input[type=${t}]`),
  'textarea',
  '[contenteditable]:not([contenteditable=false])',
].join(', ')

function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(TEXT_ENTRY)
}

/** Shortcuts are off while a dialog is open, so its counts and lists can't go stale (§12.6). */
function isInDialog(target: EventTarget | null): boolean {
  return (
    (target instanceof Element && target.closest('[role=dialog], [role=alertdialog]') !== null) ||
    document.querySelector('[role=dialog][aria-modal=true], [role=alertdialog][aria-modal=true]') !== null
  )
}

/**
 * The letter typed, so Dvorak and AZERTY users press the key labeled Z. On
 * non-Latin layouts (e.g. `я` on a Russian layout), the physical key instead.
 */
function keyOf(e: KeyboardEvent): string {
  const key = e.key.toLowerCase()
  const nonLatinLetter = /^\p{L}$/u.test(key) && !/^[a-z]$/.test(key)
  if (nonLatinLetter && e.code === 'KeyZ') return 'z'
  if (nonLatinLetter && e.code === 'KeyY') return 'y'
  return key
}

/**
 * App undo/redo shortcuts (§12.1): Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, and Ctrl+Y.
 * Text-entry fields keep the browser's native in-field undo (§12.2).
 */
export function useUndoShortcuts(onUndo: () => void, onRedo: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || isTextEntry(e.target) || isInDialog(e.target)) return
      const key = keyOf(e)
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
      } else if (key === 'y' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault()
        onRedo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onUndo, onRedo])
}
