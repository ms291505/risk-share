/**
 * Commits the draft of a focused text field (blur commits it) and puts focus
 * back, e.g. so an export includes what's being typed.
 */
export function commitActiveField(): void {
  const el = document.activeElement
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  el.blur()
  el.focus()
}
