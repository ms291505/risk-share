import type Big from 'big.js'
import { parseAmount } from './amounts'
import { decimalPlaces, parseDecimal } from './decimal'
import { activeSides } from './terms'
import type { Issue, Side, SideKey, Terms } from './types'

/** Product decision, not in the requirements: CR precision is 0–4 decimals. */
export const MAX_CR_PRECISION = 4
/** Agreed with the user: share % and %-of-additions caps allow up to 2 decimals. */
export const PCT_DECIMALS = 2

function checkPct(
  s: string | undefined,
  path: string[],
  issues: Issue[],
  outOfRange: 'pctOutOfRange' | 'shareOutOfRange' = 'pctOutOfRange',
): void {
  const x = parseDecimal(s)
  if (x === null) {
    issues.push({ code: 'invalidNumber', path })
  } else if (decimalPlaces(x) > PCT_DECIMALS) {
    issues.push({ code: 'tooManyDecimals', path, params: { max: PCT_DECIMALS } })
  } else if (x.lt(0) || x.gt(100)) {
    issues.push({ code: outOfRange, path })
  }
}

function validateSide(terms: Terms, key: SideKey, side: Side, minorUnits: number): Issue[] {
  const issues: Issue[] = []
  if (side.tiers.length === 0) issues.push({ code: 'noTiers', path: [key, 'tiers'] })

  const isCR = terms.unit === 'costRatio'
  // Gain-side CR thresholds descend away from break-even; all others ascend.
  const descending = isCR && key === 'gain'
  let prev: Big | null = null

  for (const tier of side.tiers) {
    const tPath = [key, 'tiers', tier.id, 'threshold']
    let t: Big | null = null
    if (isCR) {
      const x = parseDecimal(tier.threshold)
      if (x === null) issues.push({ code: 'invalidNumber', path: tPath })
      else if (decimalPlaces(x) > terms.crPrecision)
        issues.push({ code: 'tooManyDecimals', path: tPath, params: { max: terms.crPrecision } })
      else if (key === 'gain' && x.gt(100)) issues.push({ code: 'gainThresholdAbove100', path: tPath })
      else if (key === 'loss' && x.lt(100)) issues.push({ code: 'lossThresholdBelow100', path: tPath })
      else t = x
    } else {
      t = parseAmount(tier.threshold, minorUnits, tPath, issues)
      if (t?.lt(0)) {
        issues.push({ code: 'thresholdNegative', path: tPath })
        t = null
      }
    }
    if (t !== null && prev !== null && (descending ? !t.lt(prev) : !t.gt(prev))) {
      issues.push({
        code: 'thresholdsNotOrdered',
        path: tPath,
        params: { direction: descending ? 'descending' : 'ascending' },
      })
    }
    if (t !== null) prev = t

    checkPct(tier.sharePct, [key, 'tiers', tier.id, 'sharePct'], issues, 'shareOutOfRange')
  }

  const { limits } = side
  const lPath = (f: string) => [key, 'limits', f]
  const nonNegativeAmount = (s: string, path: string[]) => {
    const x = parseAmount(s, minorUnits, path, issues)
    if (x?.lt(0)) {
      issues.push({ code: 'negativeAmount', path })
      return null
    }
    return x
  }
  const max = limits.maxPayout ? nonNegativeAmount(limits.maxPayout, lPath('maxPayout')) : null
  if (limits.maxPayoutPctOfAdditions) {
    checkPct(limits.maxPayoutPctOfAdditions, lPath('maxPayoutPctOfAdditions'), issues)
  }
  const min = limits.minimum ? nonNegativeAmount(limits.minimum.amount, lPath('minimum')) : null
  if (max !== null && min !== null && max.lt(min)) {
    issues.push({ code: 'maxPayoutBelowMinimum', path: lPath('maxPayout') })
  }
  return issues
}

/** §6.4. Only the sides used by the terms' type are checked. */
export function validateTerms(terms: Terms, minorUnits: number): Issue[] {
  const issues: Issue[] = []
  if (
    !Number.isInteger(terms.crPrecision) ||
    terms.crPrecision < 0 ||
    terms.crPrecision > MAX_CR_PRECISION
  ) {
    issues.push({ code: 'invalidPrecision', path: ['crPrecision'], params: { max: MAX_CR_PRECISION } })
    return issues // threshold checks depend on the precision
  }
  for (const key of activeSides(terms)) {
    const side = terms[key]
    if (!side) issues.push({ code: 'missingSide', path: [key] })
    else issues.push(...validateSide(terms, key, side, minorUnits))
  }
  return issues
}
