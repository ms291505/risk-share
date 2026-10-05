const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * The user-perceived characters of a string, so 👨‍👩‍👧, 👍🏽 and 🇺🇸 each count
 * as one and are never split.
 */
export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment)
}
