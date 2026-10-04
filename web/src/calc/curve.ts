import BigJs from 'big.js'
import type Big from 'big.js'
import { makeTotals } from './amounts'
import { D, HUNDRED, maxBig, minBig, niceStep, ZERO } from './decimal'
import { settleValidated } from './settle'
import { activeSides } from './terms'
import type { CalcContext, Invalid, Settlement, SideKey, Terms, TraceStep } from './types'
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
  /**
   * Signed settlement before rounding to the minor unit. Exactly linear between
   * kinks, so `curveBreakpoints` can find them without mistaking cent rounding
   * for a change of slope.
   */
  unrounded: Big
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
 * the span as margin on each side. Gains can't exceed the additions
 * (deductions are never negative, §4), so the range stops there and only
 * reachable thresholds set it. Thresholds are added as exact points so the
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
    const reachable = xs.filter((x) => x.lte(additions))
    const lo = reachable.reduce(minBig, ZERO)
    const hi = reachable.reduce(maxBig, ZERO)
    const span = hi.minus(lo)
    // With every reachable threshold at break-even, fall back to ±10% of the additions.
    const margin = span.gt(0) ? span.times('0.5') : additions.times('0.1')
    from = lo.minus(margin)
    to = minBig(hi.plus(margin), additions)
  }
  const roughStep = to.minus(from).toNumber() / (MAX_CURVE_POINTS - 2 - xs.length)
  const step = maxBig(D(`1e-${minorUnits}`), roughStep > 0 ? niceStep(roughStep) : D(1))
  // Dividing by 1, 2 or 5 × 10ⁿ is exact.
  const start = from.div(step).round(0, BigJs.roundDown).times(step)
  const inRange = xs.filter((x) => x.gt(start) && x.lt(to))
  const all = [...grid(start, to, step), ...inRange].sort((a, b) => a.cmp(b))
  return all.filter((x, i) => i === 0 || !x.eq(all[i - 1]))
}

/** The signed settlement before rounding to the minor unit. */
function unroundedSigned(s: Settlement): Big {
  const rounding = s.trace.find((t): t is Extract<TraceStep, { kind: 'rounding' }> => t.kind === 'rounding')
  const amount = rounding?.before ?? ZERO
  return s.side === 'loss' ? amount.neg() : amount
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
  if (range && terms.unit === 'currency' && range.to.gt(additions)) {
    issues.push({ code: 'rangeAboveAdditions', path: ['range'] })
  }
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
    const s = settleValidated(terms, makeTotals(additions, deductions, ZERO), ctx)
    return { x, signed: s.signed, unrounded: unroundedSigned(s) }
  })
  return { ok: true, axis, points, thresholds, corridor }
}

/**
 * The points where the curve changes slope, plus both ends: enough to describe
 * it in a data table (§13.3) without one row per plotted point. Slopes are
 * compared exactly (by cross-multiplication) on the unrounded settlement, so
 * cent rounding doesn't add rows. A kink that falls between plotted points,
 * such as where a cap starts to apply, shows as the points on either side.
 */
export function curveBreakpoints(points: CurvePoint[]): CurvePoint[] {
  return points.filter((p, i) => {
    if (i === 0 || i === points.length - 1) return true
    const prev = points[i - 1]
    const next = points[i + 1]
    const left = p.unrounded.minus(prev.unrounded).times(next.x.minus(p.x))
    const right = next.unrounded.minus(p.unrounded).times(p.x.minus(prev.x))
    return !left.eq(right)
  })
}
