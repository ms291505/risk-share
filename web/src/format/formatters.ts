import type Big from 'big.js'
import { minorUnits, type Parties } from '../calc'

/** Exact `Big` values, or display-only numbers (e.g. chart ticks). */
type Num = Big | number

/**
 * Big values are passed to Intl as decimal strings so formatting stays exact.
 * That needs Intl.NumberFormat v3; older engines silently convert strings to
 * Number, which is why it is part of the supported-browser check (§1.6).
 */
const exact = (x: Num) => (typeof x === 'number' ? x : (x.toFixed() as `${number}`))

export interface Formatters {
  /** Fixed to the currency's minor unit, e.g. "$50,000.00". */
  currency(x: Num): string
  /** With an explicit sign, e.g. "+$50,000.00"; zero has no sign. */
  signedCurrency(x: Num): string
  /** Without a sign, for text that says the direction in words, e.g. "Loss $50,000.00". */
  unsignedCurrency(x: Num): string
  /** Short form for chart axes, e.g. "$50K". */
  compactCurrency(x: number): string
  /**
   * A percentage value such as 85.0 → "85.0%", always with `decimals` decimals
   * (§5.4). Intl rounds half away from zero, so result values must already be
   * rounded to `decimals` with the terms' mode (use the CR from `settle` or
   * `computeCR`), or the display could disagree with the settlement.
   */
  pct(x: Num, decimals: number): string
}

export function makeFormatters(locale: string, currency: string): Formatters {
  // Same minor unit as calc's rounding, so display and settlement agree by construction.
  const digits = minorUnits(currency)
  const moneyOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  } as const
  const money = new Intl.NumberFormat(locale, moneyOptions)
  const signedMoney = new Intl.NumberFormat(locale, { ...moneyOptions, signDisplay: 'exceptZero' })
  const unsignedMoney = new Intl.NumberFormat(locale, { ...moneyOptions, signDisplay: 'never' })
  const compact = new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact' })
  const pctFormats = new Map<number, Intl.NumberFormat>()
  const pctFormat = (decimals: number) => {
    let f = pctFormats.get(decimals)
    if (!f) {
      f = new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
      pctFormats.set(decimals, f)
    }
    return f
  }
  return {
    currency: (x) => money.format(exact(x)),
    signedCurrency: (x) => signedMoney.format(exact(x)),
    unsignedCurrency: (x) => unsignedMoney.format(exact(x)),
    compactCurrency: (x) => compact.format(x),
    // Percent style multiplies by 100; shift the decimal point in the string instead of dividing.
    pct: (x, decimals) =>
      pctFormat(decimals).format(typeof x === 'number' ? x / 100 : (`${x.toFixed()}e-2` as `${number}`)),
  }
}

/** Who pays whom for a signed settlement (§6.1.6): positive means the risk-bearer pays. */
export function direction(signed: Num, parties: Parties): string {
  const sign = typeof signed === 'number' ? Math.sign(signed) : signed.cmp(0)
  if (sign > 0) return `${parties.riskBearer} pays ${parties.counterparty}`
  if (sign < 0) return `${parties.counterparty} pays ${parties.riskBearer}`
  return 'No payment'
}

/** "Gain $5.00", "Loss $5.00" or "Break-even", so a loss isn't shown by a minus sign alone (§4.2). */
export function gainOrLoss(gainLoss: Big, f: Formatters): string {
  const sign = gainLoss.cmp(0)
  if (sign > 0) return `Gain ${f.currency(gainLoss)}`
  if (sign < 0) return `Loss ${f.unsignedCurrency(gainLoss)}`
  return 'Break-even'
}

const MAX_UNROUNDED_DECIMALS = 4

/**
 * A percentage before any rounding, such as the CR in the amount set editor:
 * exact up to 4 decimals ("80.05%"), approximate beyond that ("≈33.3333%").
 */
export function unroundedPct(x: Big, f: Formatters): string {
  const decimals = x.toFixed().split('.')[1]?.length ?? 0
  return decimals > MAX_UNROUNDED_DECIMALS ? `≈${f.pct(x, MAX_UNROUNDED_DECIMALS)}` : f.pct(x, decimals)
}
