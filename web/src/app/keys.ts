/** Helpers for app-wide keyboard shortcuts. */

/** Fields with their own native undo (§12.2). Checkboxes, radios and other non-text inputs aren't included. */
const TEXT_ENTRY = [
  'input:not([type])',
  ...['text', 'search', 'email', 'url', 'tel', 'password', 'number'].map((t) => `input[type=${t}]`),
  'textarea',
  '[contenteditable]:not([contenteditable=false])',
].join(', ')

export function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(TEXT_ENTRY)
}

/** Shortcuts are off while a dialog is open, so its counts and lists can't go stale (§12.6). */
export function isInDialog(target: EventTarget | null): boolean {
  return (
    (target instanceof Element && target.closest('[role=dialog], [role=alertdialog]') !== null) ||
    document.querySelector('[role=dialog][aria-modal=true], [role=alertdialog][aria-modal=true]') !== null
  )
}

/**
 * The letter typed, so Dvorak and AZERTY users press the key labeled Z. On
 * non-Latin layouts (e.g. `я` on a Russian layout), the physical key instead.
 */
export function keyOf(e: KeyboardEvent): string {
  const key = e.key.toLowerCase()
  const nonLatinLetter = /^\p{L}$/u.test(key) && !/^[a-z]$/.test(key)
  const physical = /^Key([A-Z])$/.exec(e.code)
  return nonLatinLetter && physical ? physical[1].toLowerCase() : key
}
