import type Big from 'big.js'
import { D, HUNDRED, minBig, ZERO } from './decimal'
import type { AmountTotals, Side, SideKey, ThresholdUnit, TraceStep } from './types'

export interface TieredResult {
  /** True when the measure is beyond the side's first threshold. */
  inPlay: boolean
  amount: Big
  steps: TraceStep[]
}

/**
 * Marginal tiered amount for one side (§6.1.3–6.1.5, §6.2), before limits.
 *
 * Every side is mapped onto a "distance from break-even" axis where tiers
 * ascend: CR gain side uses −CR, CR loss side uses CR, currency sides use the
 * gain or the loss. Each band pays share% of the part of the band reached.
 * Assumes the side has been validated.
 */
export function tieredAmount(
  sideKey: SideKey,
  side: Side,
  unit: ThresholdUnit,
  totals: AmountTotals,
  roundedCrPct: Big,
): TieredResult {
  // Currency thresholds are already entered as distances (gain or loss amounts).
  const isCR = unit === 'costRatio'
  const toAxis = (v: Big) => (isCR && sideKey === 'gain' ? v.neg() : v)
  const measure = isCR
    ? toAxis(roundedCrPct)
    : sideKey === 'gain'
      ? totals.gainLoss
      : totals.gainLoss.neg()
  // CR bands are in CR points: pts ÷ 100 × additions. Currency bands are amounts.
  const perUnit = isCR ? totals.additions.div(HUNDRED) : D(1)

  const thresholds = side.tiers.map((t) => D(t.threshold))
  const steps: TraceStep[] = []
  let amount = ZERO

  side.tiers.forEach((tier, i) => {
    const from = thresholds[i]
    const to = i + 1 < thresholds.length ? thresholds[i + 1] : null
    const lo = toAxis(from)
    let width = ZERO
    if (measure.gt(lo)) width = (to === null ? measure : minBig(measure, toAxis(to))).minus(lo)
    const sharePct = D(tier.sharePct)
    const bandAmount = sharePct.div(HUNDRED).times(width).times(perUnit)
    amount = amount.plus(bandAmount)
    steps.push({
      kind: 'tier',
      side: sideKey,
      tierId: tier.id,
      name: tier.name,
      from,
      to,
      sharePct,
      width,
      amount: bandAmount,
    })
  })

  steps.push({ kind: 'tieredTotal', amount })
  return { inPlay: measure.gt(toAxis(thresholds[0])), amount, steps }
}
