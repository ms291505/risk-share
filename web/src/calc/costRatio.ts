import type Big from 'big.js'
import { D, decimalPlaces, HUNDRED } from './decimal'
import type { CostRatio, RoundingMode } from './types'

/** x · 10^scale as a bigint; `scale` must be ≥ the decimals of x. */
function toScaledInt(x: Big, scale: number): bigint {
  return BigInt(x.toFixed(scale).replace('.', ''))
}

/**
 * Cost ratio as a percentage, rounded exactly (§5).
 *
 * Works on integers: q, rem = (deductions · 10^(precision+2)) ÷ additions, then
 * applies the rounding mode using the remainder, so no binary or truncated
 * decimal division is involved. `additions` must be > 0.
 */
export function computeCR(
  additions: Big,
  deductions: Big,
  precision: number,
  mode: RoundingMode,
): CostRatio {
  if (additions.lte(0)) throw new RangeError('computeCR: additions must be > 0')
  const k = Math.max(decimalPlaces(additions), decimalPlaces(deductions))
  const a = toScaledInt(additions, k)
  const scaled = toScaledInt(deductions, k) * 10n ** BigInt(precision + 2)

  let q = scaled / a // truncates toward zero
  const rem = scaled % a // same sign as `scaled`
  const twiceRem = 2n * (rem < 0n ? -rem : rem)
  const awayFromZero =
    mode === 'halfUp'
      ? twiceRem >= a
      : mode === 'halfEven'
        ? twiceRem > a || (twiceRem === a && q % 2n !== 0n)
        : false
  if (awayFromZero && rem !== 0n) q += scaled < 0n ? -1n : 1n

  return {
    unroundedPct: deductions.times(HUNDRED).div(additions),
    roundedPct: D(q.toString()).div(D(10).pow(precision)),
    precision,
    mode,
  }
}
