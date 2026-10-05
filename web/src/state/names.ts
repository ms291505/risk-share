import type { Issue } from '../calc'
import { graphemes } from '../format/graphemes'

/** Party and tag names (§3.3, §8.2). */
export const MAX_NAME_LENGTH = 80

/** Names are trimmed before they're stored. */
export function normalizeName(name: string): string {
  return name.trim()
}

/** Length in user-perceived characters, so any emoji (even 👨‍👩‍👧 or 🇺🇸) counts as one. */
export function nameLength(name: string): number {
  return graphemes(name).length
}

/** Names compare ignoring case and surrounding spaces. Locale-independent, so every browser agrees. */
export function sameName(a: string, b: string): boolean {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase()
}

/** A trimmed name must be non-empty and at most 80 characters. */
export function nameIssues(name: string, path: string[]): Issue[] {
  const trimmed = normalizeName(name)
  if (trimmed === '') return [{ code: 'nameEmpty', path }]
  if (nameLength(trimmed) > MAX_NAME_LENGTH) return [{ code: 'nameTooLong', path, params: { max: MAX_NAME_LENGTH } }]
  return []
}
