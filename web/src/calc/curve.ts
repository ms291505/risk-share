import BigJs from 'big.js'
import type Big from 'big.js'
import { makeTotals } from './amounts'
import { D, HUNDRED, ZERO } from './decimal'
import { settleValidated } from './settle'
import { activeSides } from './terms'
import type { CalcContext, Invalid, SideKey, Terms } from './types'
import { validateTerms } from './validateTerms'

export const MAX_CURVE_POINTS = 1000
/** Default margin around the outermost thresholds, in CR points. */
const MARGIN = D(15)

export interface ThresholdMarker {
  side: SideKey
  tierId: string
  name: string
  /** Where the threshold sits on the CR axis (converted for currency terms). */
  crPct: Big
}

export interface SettlementCurve {
  ok: true
  /** Signed settlement (§6.1.6) at each CR on the precision grid, always ending at the range's end. */
  points: { crPct: Big; signed: Big }[]
  thresholds: ThresholdMarker[]
  /** Full risk share only: the neutral band between the first gain and loss thresholds. */
  corridor: { from: Big; to: Big } | null
}

/** A threshold's position on the CR axis for the given additions. */
function thresholdCR(terms: Terms, side: SideKey, threshold: Big, additions: Big): Big {
  if (terms.unit === 'costRatio') return threshold
  const pts = threshold.div(additions).times(HUNDRED)
  return side === 'gain' ? HUNDRED.minus(pts) : HUNDRED.plus(pts)
}

/**
 * Data for the settlement-vs-cost-ratio chart (§10.1). Points sit on the
 * terms' CR precision grid (coarsened to stay under MAX_CURVE_POINTS), so the
 * staircase from settling on the rounded CR shows exactly.
 */
export function settlementCurve(
  terms: Terms,
  additions: Big,
  ctx: CalcContext,
  range?: { from: Big; to: Big },
): SettlementCurve | Invalid {
  const issues = validateTerms(terms, ctx.minorUnits)
  if (additions.lte(0)) issues.push({ code: 'additionsNotPositive', path: ['additions'] })
  if (range && range.from.gt(range.to)) issues.push({ code: 'invalidRange', path: ['range'] })
  if (issues.length) return { ok: false, issues }

  const thresholds: ThresholdMarker[] = activeSides(terms).flatMap((side) =>
    terms[side]!.tiers.map((t) => ({
      side,
      tierId: t.id,
      name: t.name,
      crPct: thresholdCR(terms, side, D(t.threshold), additions),
    })),
  )
  const corridor =
    terms.type === 'full'
      ? {
          from: thresholds.find((t) => t.side === 'gain')!.crPct,
          to: thresholds.find((t) => t.side === 'loss')!.crPct,
        }
      : null

  const unit = D(1).div(D(10).pow(terms.crPrecision))
  const crs = thresholds.map((t) => t.crPct)
  const lo = range?.from ?? crs.reduce((a, b) => (a.lt(b) ? a : b)).minus(MARGIN)
  const hi = range?.to ?? crs.reduce((a, b) => (a.gt(b) ? a : b)).plus(MARGIN)
  // Snap the range outward to the grid, and coarsen the step to cap the point
  // count (leaving room for an off-grid end point).
  const from = lo.div(unit).round(0, BigJs.roundDown).times(unit)
  const to = hi.div(unit).round(0, BigJs.roundUp).times(unit)
  const units = to.minus(from).div(unit).toNumber()
  const step = unit.times(Math.max(1, Math.ceil(units / (MAX_CURVE_POINTS - 2))))

  const at = (cr: Big) => ({
    crPct: cr,
    signed: settleValidated(terms, makeTotals(additions, additions.times(cr).div(HUNDRED), ZERO), ctx)
      .signed,
  })
  const points: SettlementCurve['points'] = []
  for (let cr = from; cr.lte(to); cr = cr.plus(step)) points.push(at(cr))
  if (!points.at(-1)!.crPct.eq(to)) points.push(at(to))
  return { ok: true, points, thresholds, corridor }
}
