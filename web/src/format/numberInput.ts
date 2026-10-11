import { isDecimalString, type DecimalString, type Issue } from '../calc'

export interface NumberInputOptions {
  /** BCP 47 tag whose decimal and grouping separators are used (§2.4). */
  locale: string
  /** ISO 4217 code: its symbol or code may surround the number, e.g. pasted "$1,000.00". */
  currency?: string
  /** A percent sign may surround the number, e.g. "85%". */
  percent?: boolean
}

export type ParsedNumber = { ok: true; value: DecimalString | '' } | { ok: false; issue: Issue }

interface LocaleSymbols {
  decimal: string
  group: string
  minusSigns: string[]
  /** Native digits 0–9, e.g. Arabic-Indic. */
  digits: string[]
  /** Currency or percent signs allowed around the number, longest first so "US$" is matched before "$". */
  unitMarks: string[]
}

/** Space, no-break space and narrow no-break space. */
const SPACES = /[ \u00A0\u202F]/g
const APOSTROPHES = /['\u2019]/g
/** Bidi marks some locales put around numbers: Arabic letter mark, left-to-right and right-to-left marks. */
const BIDI_MARKS = /[\u061C\u200E\u200F]/g
/** The most decimals Intl.NumberFormat can show. */
const MAX_INTL_DECIMALS = 100

const symbolCache = new Map<string, LocaleSymbols>()

function localeSymbols(locale: string, currency = '', percent = false): LocaleSymbols {
  const key = `${locale}|${currency}|${percent}`
  const cached = symbolCache.get(key)
  if (cached) return cached
  const part = (type: Intl.NumberFormatPartTypes) =>
    new Intl.NumberFormat(locale).formatToParts(-1234567.5).find((p) => p.type === type)?.value ?? ''
  const plain = new Intl.NumberFormat(locale, { useGrouping: false })
  const currencyMark = (currencyDisplay: 'symbol' | 'narrowSymbol') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay })
      .formatToParts(1)
      .find((p) => p.type === 'currency')?.value ?? ''
  const percentSign = () =>
    new Intl.NumberFormat(locale, { style: 'percent' }).formatToParts(1).find((p) => p.type === 'percentSign')?.value
  const marks = [
    ...(currency ? [currencyMark('symbol'), currencyMark('narrowSymbol'), currency] : []),
    ...(percent ? [percentSign(), '%'] : []),
  ]
  const symbols: LocaleSymbols = {
    decimal: part('decimal'),
    group: part('group'),
    minusSigns: [...new Set(['-', '\u2212', part('minusSign')])],
    digits: Array.from({ length: 10 }, (_, d) => plain.format(d)),
    unitMarks: [...new Set(marks)].filter((m): m is string => Boolean(m)).sort((a, b) => b.length - a.length),
  }
  symbolCache.set(key, symbols)
  return symbols
}

function unreadable(locale: string): ParsedNumber {
  const example = new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(1234.56)
  return {
    ok: false,
    issue: { code: 'unreadableNumber', path: [], params: { example, decimal: localeSymbols(locale).decimal } },
  }
}

/**
 * Reads a number typed in the workspace locale (§2.4), e.g. "1.000,50" in
 * de-DE, as a canonical decimal string. Blank text is `''`. Anything that
 * could be read more than one way is an error rather than a guess: grouping
 * must be exactly the locale's, so "1.5" in de-DE and "1,00" in en-US are
 * rejected, though "1000" without grouping is always fine. Also accepts the
 * workspace currency's symbol or code (or a percent sign), accounting
 * negatives "(5,000)" and the Unicode minus "−". Decimals are kept as typed; checking them against the
 * currency's minor unit is left to calc (§2.5).
 */
export function parseNumberInput(text: string, { locale, currency, percent }: NumberInputOptions): ParsedNumber {
  const sym = localeSymbols(locale, currency, percent)
  let s = text.replace(BIDI_MARKS, '').trim()
  if (s === '') return { ok: true, value: '' }

  let hasUnit = false
  const dropUnit = () => {
    if (hasUnit) return
    const mark = sym.unitMarks.find((m) => s.startsWith(m) || s.endsWith(m))
    if (!mark) return
    hasUnit = true
    s = (s.startsWith(mark) ? s.slice(mark.length) : s.slice(0, -mark.length)).trim()
  }

  let negative = false
  const inParens = /^\((.*)\)$/s.exec(s)
  if (inParens) {
    negative = true
    s = inParens[1].trim()
  }
  dropUnit() // "$-5", "5 $", "($5)"
  const minus = sym.minusSigns.find((m) => s.startsWith(m))
  if (minus) {
    if (negative) return unreadable(locale)
    negative = true
    s = s.slice(minus.length).trim()
  }
  dropUnit() // "-$5"

  // Spaces and apostrophes look alike, and browsers disagree on which one a locale uses.
  if (/^\s$/.test(sym.group)) s = s.replace(SPACES, sym.group)
  else if (sym.group === "'" || sym.group === '\u2019') s = s.replace(APOSTROPHES, sym.group)
  s = toAsciiDigits(s, sym.digits)

  const parts = s.split(sym.decimal)
  if (parts.length > 2) return unreadable(locale)
  const [grouped, fraction = ''] = parts
  const integer = grouped.split(sym.group).join('')
  if (!/^\d*$/.test(integer) || !/^\d*$/.test(fraction) || integer + fraction === '') return unreadable(locale)
  if (grouped !== integer && grouped !== groupAlways(integer, locale, sym.digits)) return unreadable(locale)

  const digits = integer.replace(/^0+(?=\d)/, '') || '0'
  const value = fraction ? `${digits}.${fraction}` : digits
  const isZero = /^0(\.0*)?$/.test(value)
  return { ok: true, value: negative && !isZero ? `-${value}` : value }
}

function toAsciiDigits(s: string, digits: string[]): string {
  if (digits[0] === '0') return s
  return [...s].map((c) => (digits.includes(c) ? String(digits.indexOf(c)) : c)).join('')
}

/** The locale's grouping of an integer, even where it would normally skip it (es-ES "1234"). */
function groupAlways(integer: string, locale: string, digits: string[]): string {
  const formatted = new Intl.NumberFormat(locale, { useGrouping: 'always' }).format(BigInt(integer || '0'))
  return toAsciiDigits(formatted, digits)
}

export interface FormatNumberInputOptions {
  locale: string
  /** At least this many decimals are shown, e.g. the currency's minor unit. */
  minFractionDigits: number
}

/**
 * The text a number field shows for a stored value: grouped, with at least
 * `minFractionDigits` decimals and never fewer than the value has, so extra
 * decimals stay visible. Exact, like `makeFormatters`. A value that isn't a
 * decimal string (e.g. from an imported file), or has more decimals than
 * Intl can show, is shown unchanged.
 */
export function formatNumberInput(value: string, { locale, minFractionDigits }: FormatNumberInputOptions): string {
  if (!isDecimalString(value)) return value
  const decimals = Math.max(minFractionDigits, value.split('.')[1]?.length ?? 0)
  if (decimals > MAX_INTL_DECIMALS) return value
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(
    value as `${number}`,
  )
}

/** The workspace currency's symbol and which side of the number the locale puts it. */
export function currencyAffix(locale: string, currency: string): { symbol: string; position: 'start' | 'end' } {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1)
  const at = (type: Intl.NumberFormatPartTypes) => parts.findIndex((p) => p.type === type)
  return {
    symbol: parts[at('currency')]?.value ?? currency,
    position: at('currency') < at('integer') ? 'start' : 'end',
  }
}
