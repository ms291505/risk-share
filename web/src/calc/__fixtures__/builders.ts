// Test-only builders for compact fixtures. Tests that assert on ids pass their own.
import { D } from '../decimal'
import type { AmountSet, Invalid, Side, SideLimits, Terms, TermsType, ThresholdUnit } from '../types'

let seq = 0
const id = () => `id${++seq}`

export const USD = { minorUnits: 2 }

/** Unwraps an ok result, or fails the test with the issues. */
export function expectOk<T extends { ok: true } | Invalid>(r: T): Exclude<T, Invalid> {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify((r as Invalid).issues)}`)
  return r as Exclude<T, Invalid>
}

export function amounts(additions: string, deductions: string, paidByCounterparty?: string): AmountSet {
  return {
    id: id(),
    name: 'Amounts',
    additions: { mode: 'total', total: additions, components: [], paidByCounterparty },
    deductions: { mode: 'total', total: deductions, components: [] },
  }
}

/** Amounts with deductions chosen so that CR = pct with additions of 1,000,000. */
export function atCR(pct: string): AmountSet {
  return amounts('1000000', D(pct).times(10000).toFixed(0))
}

export function side(tiers: [threshold: string, sharePct: string][], limits: SideLimits = {}): Side {
  return {
    tiers: tiers.map(([threshold, sharePct], i) => ({
      id: id(),
      name: `Tier ${i + 1}`,
      threshold,
      sharePct,
    })),
    limits,
  }
}

export function terms(
  type: TermsType,
  sides: { gain?: Side; loss?: Side },
  opts: Partial<Pick<Terms, 'unit' | 'crPrecision' | 'roundingMode'>> & { unit?: ThresholdUnit } = {},
): Terms {
  return {
    id: id(),
    name: 'Terms',
    unit: opts.unit ?? 'costRatio',
    type,
    crPrecision: opts.crPrecision ?? 1,
    roundingMode: opts.roundingMode ?? 'halfUp',
    ...sides,
  }
}
