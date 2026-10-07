import { useEffect } from 'react'
import { isInDialog, isTextEntry, keyOf } from './keys'

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
