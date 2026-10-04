import BigJs from 'big.js'
import type Big from 'big.js'
import { makeTotals } from './amounts'
import { D, HUNDRED, maxBig, minBig, ZERO } from './decimal'
import { settleValidated } from './settle'
import { activeSides } from './terms'
import type { CalcContext, Invalid, SideKey, Terms } from './types'
import { validateTerms } from './validateTerms'

export const MAX_CURVE_POINTS = 1000
/** Default margin around the outermost thresholds on the cost ratio axis, in CR points. */
const CR_MARGIN = D(15)

/**
 * Cost ratio terms plot against CR (%). Currency terms plot against gain/loss
 * in currency (positive is a gain), so their thresholds stay put when the
 * preview additions change.
 */
export type CurveAxis = 'costRatio' | 'currency'

export interface ThresholdMarker {
  side: SideKey
  tierId: string
  name: string
  /** Position on the curve's axis: a CR percentage, or a signed gain/loss amount. */
  x: Big
}

export interface CurvePoint {
  x: Big
  /** Signed settlement (§6.1.6). */
  signed: Big
}

export interface SettlementCurve {
  ok: true
  axis: CurveAxis
  /** In ascending x, always including both ends of the range. */
  points: CurvePoint[]
  thresholds: ThresholdMarker[]
  /** Full risk share only: the neutral band between the first gain and loss thresholds. */
  corridor: { from: Big; to: Big } | null
}

function thresholdX(terms: Terms, side: SideKey, threshold: Big): Big {
  if (terms.unit === 'costRatio') return threshold
  return side === 'gain' ? threshold : threshold.neg()
}

/** The smallest 1, 2 or 5 × 10ⁿ that is ≥ x (x > 0). Only picks a step size, so a number is precise enough. */
export function niceStep(x: number): Big {
  const [mantissa, exp] = x.toExponential().split('e')
  const m = Number(mantissa)
  const nice = [1, 2, 5, 10].find((n) => n >= m)!
  return D(`${nice}e${exp}`)
}

/** Points from..to on multiples of `step`, plus the off-grid end point when needed. */
function grid(from: Big, to: Big, step: Big): Big[] {
  const xs: Big[] = []
  for (let x = from; x.lte(to); x = x.plus(step)) xs.push(x)
  if (!xs.at(-1)!.eq(to)) xs.push(to)
  return xs
}

/** CR axis: points on the terms' precision grid, so the staircase from rounding shows exactly. */
function crGrid(terms: Terms, xs: Big[], range?: { from: Big; to: Big }): Big[] {
  const unit = D(`1e-${terms.crPrecision}`)
  const lo = range?.from ?? xs.reduce(minBig).minus(CR_MARGIN)
  const hi = range?.to ?? xs.reduce(maxBig).plus(CR_MARGIN)
  // Snap outward to the grid, and coarsen the step to cap the point count
  // (leaving room for an off-grid end point).
  const from = lo.div(unit).round(0, BigJs.roundDown).times(unit)
  const to = hi.div(unit).round(0, BigJs.roundUp).times(unit)
  const units = to.minus(from).div(unit).toNumber()
  return grid(from, to, unit.times(Math.max(1, Math.ceil(units / (MAX_CURVE_POINTS - 2)))))
}

/**
 * Currency axis: a nice step across break-even and the thresholds, with half
 * the span as margin on each side. Thresholds are added as exact points so the
 * kinks land on them.
 */
function currencyGrid(
  xs: Big[],
  additions: Big,
  minorUnits: number,
  range?: { from: Big; to: Big },
): Big[] {
  let from = range?.from
  let to = range?.to
  if (!from || !to) {
    const lo = minBig(ZERO, xs.reduce(minBig))
    const hi = maxBig(ZERO, xs.reduce(maxBig))
    const span = hi.minus(lo)
    // With every threshold at break-even, fall back to ±10% of the additions.
    const margin = span.gt(0) ? span.times('0.5') : additions.times('0.1')
    from = lo.minus(margin)
    to = hi.plus(margin)
  }
  const roughStep = to.minus(from).toNumber() / (MAX_CURVE_POINTS - 2 - xs.length)
  const step = maxBig(D(`1e-${minorUnits}`), roughStep > 0 ? niceStep(roughStep) : D(1))
  // Dividing by 1, 2 or 5 × 10ⁿ is exact.
  const start = from.div(step).round(0, BigJs.roundDown).times(step)
  const inRange = xs.filter((x) => x.gt(start) && x.lt(to))
  const all = [...grid(start, to, step), ...inRange].sort((a, b) => a.cmp(b))
  return all.filter((x, i) => i === 0 || !x.eq(all[i - 1]))
}

/**
 * Data for the settlement chart (§10.1): signed settlement across CR for cost
 * ratio terms, or across gain/loss for currency terms.
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

  const axis: CurveAxis = terms.unit
  const thresholds: ThresholdMarker[] = activeSides(terms).flatMap((side) =>
    terms[side]!.tiers.map((t) => ({ side, tierId: t.id, name: t.name, x: thresholdX(terms, side, D(t.threshold)) })),
  )
  const first = (side: SideKey) => thresholds.find((t) => t.side === side)!.x
  const corridor =
    terms.type !== 'full'
      ? null
      : axis === 'costRatio'
        ? { from: first('gain'), to: first('loss') }
        : { from: first('loss'), to: first('gain') }

  const xs = thresholds.map((t) => t.x)
  const points = (
    axis === 'costRatio' ? crGrid(terms, xs, range) : currencyGrid(xs, additions, ctx.minorUnits, range)
  ).map((x) => {
    const deductions = axis === 'costRatio' ? additions.times(x).div(HUNDRED) : additions.minus(x)
    return { x, signed: settleValidated(terms, makeTotals(additions, deductions, ZERO), ctx).signed }
  })
  return { ok: true, axis, points, thresholds, corridor }
}

/**
 * The points where the curve changes slope, plus both ends: enough to describe
 * it in a data table (§13.3) without one row per plotted point. Uses
 * cross-multiplication so slopes are compared exactly.
 */
export function curveBreakpoints(points: CurvePoint[]): CurvePoint[] {
  return points.filter((p, i) => {
    if (i === 0 || i === points.length - 1) return true
    const prev = points[i - 1]
    const next = points[i + 1]
    const left = p.signed.minus(prev.signed).times(next.x.minus(p.x))
    const right = next.signed.minus(p.signed).times(p.x.minus(prev.x))
    return !left.eq(right)
  })
}
