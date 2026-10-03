import type Big from 'big.js'
import { D, HUNDRED, maxBig, minBig, ZERO } from './decimal'
import type { SideKey, SideLimits, TraceStep, Warning } from './types'

/** The %-of-additions cap as an amount, or null if not set. */
export function pctCap(limits: SideLimits, additions: Big): Big | null {
  return limits.maxPayoutPctOfAdditions
    ? D(limits.maxPayoutPctOfAdditions).div(HUNDRED).times(additions)
    : null
}

/** §6.3.4: the %-of-additions cap works out below the minimum payout for these additions. */
export function capBelowMinimum(side: SideKey, limits: SideLimits, additions: Big): Warning | null {
  const cap = pctCap(limits, additions)
  if (cap === null || !limits.minimum) return null
  const minimum = D(limits.minimum.amount)
  return cap.lt(minimum) ? { code: 'capBelowMinimum', side, cap, minimum } : null
}

/**
 * Applies the minimum payout, then the caps (§6.2 steps 2–3). The amount is
 * not rounded here. Assumes the limits have been validated.
 */
export function applyLimits(
  tiered: Big,
  limits: SideLimits,
  additions: Big,
): { amount: Big; steps: TraceStep[] } {
  const steps: TraceStep[] = []
  let amount = tiered

  if (limits.minimum) {
    const minimum = D(limits.minimum.amount)
    const before = amount
    if (limits.minimum.behavior === 'allOrNothing') {
      if (amount.lt(minimum)) amount = ZERO
    } else {
      amount = maxBig(ZERO, amount.minus(minimum))
    }
    steps.push({ kind: 'minimum', behavior: limits.minimum.behavior, minimum, before, after: amount })
  }

  if (limits.maxPayout) {
    const limit = D(limits.maxPayout)
    const before = amount
    amount = minBig(amount, limit)
    steps.push({ kind: 'cap', cap: 'currency', limit, before, after: amount })
  }

  const pctLimit = pctCap(limits, additions)
  if (pctLimit !== null) {
    const before = amount
    amount = minBig(amount, pctLimit)
    steps.push({
      kind: 'cap',
      cap: 'pctOfAdditions',
      pct: D(limits.maxPayoutPctOfAdditions!),
      limit: pctLimit,
      before,
      after: amount,
    })
  }

  return { amount, steps }
}
