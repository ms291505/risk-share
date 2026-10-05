let segmenter: Intl.Segmenter | undefined

/**
 * The user-perceived characters of a string, so 👨‍👩‍👧, 👍🏽 and 🇺🇸 each count
 * as one and are never split. Browsers without `Intl.Segmenter` (e.g. Firefox
 * before 125) fall back to code points, where combined emoji count as
 * several; they also get the unsupported-browser notice (§1.6). The segmenter
 * is created on first use, so a missing one never stops the app loading.
 */
export function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return [...text]
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return Array.from(segmenter.segment(text), (s) => s.segment)
}
