import BigJs from 'big.js'
import type Big from 'big.js'
import type { DecimalString, RoundingMode } from './types'

/**
 * An isolated Big constructor so app-wide config can't leak in or out.
 * Settlement math only divides by powers of ten (exact). Other divisions are
 * for display or counting (unrounded CR, sweep point counts), where DP = 50 is
 * far more than enough.
 */
export const D = BigJs()
D.DP = 50
D.RM = BigJs.roundHalfUp

export const ZERO = D(0)
export const HUNDRED = D(100)

const RM: Record<RoundingMode, Big.RoundingMode> = {
  halfUp: BigJs.roundHalfUp,
  halfEven: BigJs.roundHalfEven,
  truncate: BigJs.roundDown,
}

const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export function isDecimalString(s: unknown): s is DecimalString {
  return typeof s === 'string' && DECIMAL_RE.test(s)
}

/** Parses a canonical decimal string; returns null if it isn't one. */
export function parseDecimal(s: DecimalString | undefined): Big | null {
  return isDecimalString(s) ? D(s) : null
}

/** Number of significant decimal places (trailing zeros ignored): 85.50 → 1. */
export function decimalPlaces(x: Big): number {
  return Math.max(0, x.c.length - x.e - 1)
}

/** Rounds to `dp` decimals with the given mode (half up and truncate are symmetric around zero). */
export function round(x: Big, dp: number, mode: RoundingMode): Big {
  return x.round(dp, RM[mode])
}

/** Rounds a currency amount to the minor unit, half up: halves round away from zero (§2.3, §6.2.4). */
export function roundToMinor(x: Big, minorUnits: number): Big {
  return x.round(minorUnits, BigJs.roundHalfUp)
}

export function maxBig(a: Big, b: Big): Big {
  return a.gte(b) ? a : b
}

export function minBig(a: Big, b: Big): Big {
  return a.lte(b) ? a : b
}

/** Serializes to a fixed-scale decimal string. */
export function toDecimalString(x: Big, dp: number): DecimalString {
  const s = x.toFixed(dp)
  return s === '-0' || /^-0\.0+$/.test(s) ? s.slice(1) : s
}

/**
 * The smallest 1, 2 or 5 × 10ⁿ that is ≥ x (x > 0), for chart steps and axis
 * ticks. Only picks a step size, so a number input is precise enough; the
 * tolerance keeps float noise (0.05000000000001) from jumping a whole step.
 */
export function niceStep(x: number): Big {
  const [mantissa, exp] = x.toExponential().split('e')
  const m = Number(mantissa)
  const nice = [1, 2, 5, 10].find((n) => n >= m * (1 - 1e-9))!
  return D(`${nice}e${exp}`)
}
