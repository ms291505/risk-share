import { useEffect } from 'react'
import { isInDialog, keyOf } from './keys'

/**
 * Cmd/Ctrl+S exports the workspace instead of saving the page. It works in
 * text fields too, but not while a dialog is open (§12.6). Holding the keys
 * exports once.
 */
export function useSaveShortcut(onSave: () => unknown) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || keyOf(e) !== 's') return
      e.preventDefault()
      if (!e.repeat && !isInDialog(e.target)) onSave()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSave])
}
