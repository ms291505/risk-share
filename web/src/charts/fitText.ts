import { graphemes } from '../format/graphemes'

/** Text width in px, or null where canvas text metrics aren't available (e.g. jsdom). */
export type MeasureText = (text: string) => number | null

let context: OffscreenCanvasRenderingContext2D | null | undefined

/** Measures text with a CSS font shorthand, e.g. `12px system-ui`. */
export function canvasMeasure(font: string): MeasureText {
  return (text) => {
    context ??= typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d')
    if (!context) return null
    context.font = font
    return context.measureText(text).width
  }
}

/**
 * Shortens text with a trailing ellipsis so it fits `maxWidth`. SVG text doesn't
 * wrap or clip itself, and anything past the SVG edge would be cut from exports.
 * Returns the text unchanged when it can't be measured.
 */
export function fitText(text: string, maxWidth: number, measure: MeasureText): string {
  const width = measure(text)
  if (width === null || width <= maxWidth) return text
  // Graphemes, so an emoji (even 👨‍👩‍👧 or 🇺🇸) is never split.
  const chars = graphemes(text)
  let lo = 0
  let hi = chars.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(chars.slice(0, mid).join('').trimEnd() + '…')! <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('').trimEnd() + '…'
}
