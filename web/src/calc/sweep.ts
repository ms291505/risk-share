import BigJs from 'big.js'
import type Big from 'big.js'
import { evaluateAmountSet, groupTotal, parseAmount, type AmountOverride } from './amounts'
import { D, HUNDRED, parseDecimal, roundToMinor } from './decimal'
import { invalid as invalidOf, isInvalid, withSource } from './result'
import { settleChecked } from './settle'
import type { AmountSet, CalcContext, DecimalString, Invalid, Issue, SettleResult, Terms } from './types'
import { validateTerms } from './validateTerms'

export const MAX_SWEEP_POINTS = 200

export type SweepVariable =
  | { kind: 'additions' }
  | { kind: 'deductions' }
  | { kind: 'component'; group: 'additions' | 'deductions'; componentId: string }

/** Currency fields are rounded by `rescaleSweepSpec` when the currency changes (§2.3). */
export type CurrencyRange =
  | { kind: 'minMaxStep'; min: DecimalString; max: DecimalString; step: DecimalString }
  /** 0, ±stepPct, ±2·stepPct, … of the baseline value, plus ±pct as end points (§9.3). */
  | { kind: 'pctAroundBaseline'; pct: DecimalString; stepPct: DecimalString }

export type SweepSpec =
  | { kind: 'variable'; variable: SweepVariable; range: CurrencyRange }
  /** Holds additions fixed and derives total deductions (§9.3). Values are CR percentages. */
  | { kind: 'crRange'; from: DecimalString; to: DecimalString; step: DecimalString }

export interface SweepPoint {
  /** Swept value: a CR percentage for CR-range sweeps, otherwise a currency amount. */
  x: Big
  /** Invalid points are gaps in the chart and "—" in the table (§9.6). */
  result: SettleResult
}

export interface SweepSeries {
  termsId: string
  points: SweepPoint[]
  /** §9.5: the line moves in steps because settlements use the rounded CR. */
  staircase: boolean
}

export type SweepResult =
  | { ok: true; axis: 'costRatio' | 'currency'; xs: Big[]; series: SweepSeries[] }
  | Invalid

const invalid = (code: Issue['code'], path: string[], params?: Issue['params']) =>
  invalidOf(code, path, params, 'sweep')

function tooMany(count: number, path: string[]): Invalid | null {
  return count > MAX_SWEEP_POINTS ? invalid('tooManyPoints', path, { count, max: MAX_SWEEP_POINTS }) : null
}

/** min, min+step, … up to max; max is appended when the step doesn't land on it. */
function grid(min: Big, max: Big, step: Big, path: string[]): Big[] | Invalid {
  if (step.lte(0)) return invalid('invalidStep', [...path, 'step'])
  if (min.gt(max)) return invalid('invalidRange', path)
  const steps = max.minus(min).div(step).round(0, BigJs.roundDown)
  const onGrid = min.plus(step.times(steps)).eq(max)
  const tooManyPoints = tooMany(steps.toNumber() + (onGrid ? 1 : 2), path)
  if (tooManyPoints) return tooManyPoints
  const xs = Array.from({ length: steps.toNumber() + 1 }, (_, i) => min.plus(step.times(i)))
  if (!onGrid) xs.push(max)
  return xs
}

/** Offsets 0, ±step, ±2·step, … within ±pct, plus ±pct when off-grid; ascending. */
function symmetricOffsets(pct: Big, step: Big, path: string[]): Big[] | Invalid {
  if (step.lte(0)) return invalid('invalidStep', [...path, 'stepPct'])
  if (pct.lt(0)) return invalid('invalidRange', [...path, 'pct'])
  const k = pct.div(step).round(0, BigJs.roundDown).toNumber()
  const onGrid = step.times(k).eq(pct)
  const tooManyPoints = tooMany(2 * k + (onGrid ? 1 : 3), path)
  if (tooManyPoints) return tooManyPoints
  const inner = Array.from({ length: 2 * k + 1 }, (_, i) => step.times(i - k))
  return onGrid ? inner : [pct.neg(), ...inner, pct]
}

function parseAll(fields: Record<string, DecimalString>, path: string[]): Record<string, Big> | Invalid {
  const out: Record<string, Big> = {}
  for (const [k, v] of Object.entries(fields)) {
    const x = parseDecimal(v)
    if (x === null) return invalid('invalidNumber', [...path, k])
    out[k] = x
  }
  return out
}

/** Currency fields must be whole minor units, so grid points never repeat after rounding. */
function parseAmounts(fields: Record<string, DecimalString>, minorUnits: number): Record<string, Big> | Invalid {
  const issues: Issue[] = []
  const out: Record<string, Big> = {}
  for (const [k, v] of Object.entries(fields)) {
    const x = parseAmount(v, minorUnits, ['range', k], issues)
    if (x !== null) out[k] = x
  }
  return issues.length ? { ok: false, issues: withSource(issues, 'sweep') } : out
}

/** The baseline value of the swept variable, or issues if it is missing or inactive. */
function baselineValue(set: AmountSet, v: SweepVariable, minorUnits: number): Big | Invalid {
  const issues: Issue[] = []
  if (v.kind !== 'component') {
    return groupTotal(set[v.kind], { key: v.kind, minorUnits, issues }) ?? { ok: false, issues }
  }
  const group = set[v.group]
  const c = group.components.find((c) => c.id === v.componentId)
  if (!c) return invalid('componentNotFound', ['variable'])
  if (group.mode !== 'components') return invalid('componentInactive', ['variable'])
  const x = parseAmount(c.amount, minorUnits, [v.group, 'components', c.id, 'amount'], issues)
  return x ?? { ok: false, issues }
}

/** The x values of a sweep (§9.3–9.4). Currency values are whole minor units. */
export function buildRange(set: AmountSet, spec: SweepSpec, minorUnits: number): Big[] | Invalid {
  if (spec.kind === 'crRange') {
    const p = parseAll({ from: spec.from, to: spec.to, step: spec.step }, ['range'])
    return isInvalid(p) ? p : grid(p.from, p.to, p.step, ['range'])
  }
  const base = baselineValue(set, spec.variable, minorUnits)
  if (isInvalid(base)) return base
  const { range } = spec
  if (range.kind === 'minMaxStep') {
    const p = parseAmounts({ min: range.min, max: range.max, step: range.step }, minorUnits)
    return isInvalid(p) ? p : grid(p.min, p.max, p.step, ['range'])
  }
  const p = parseAll({ pct: range.pct, stepPct: range.stepPct }, ['range'])
  if (isInvalid(p)) return p
  const offsets = symmetricOffsets(p.pct, p.stepPct, ['range'])
  if (isInvalid(offsets)) return offsets
  // Half up, away from zero for negative baselines (§2.3 meaning, confirmed by the user).
  return offsets.map((o) => roundToMinor(base.times(HUNDRED.plus(o)).div(HUNDRED), minorUnits))
}

function overrideFor(spec: SweepSpec, x: Big): AmountOverride {
  if (spec.kind === 'crRange') return { kind: 'costRatio', pct: x }
  const v = spec.variable
  return v.kind === 'component'
    ? { kind: 'component', group: v.group, componentId: v.componentId, value: x }
    : { kind: v.kind, value: x }
}

/** Consecutive valid points whose CRs differ but round to the same value. */
function hasRepeatedRoundedCR(points: SweepPoint[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].result
    const b = points[i].result
    if (a.ok && b.ok && a.cr.roundedPct.eq(b.cr.roundedPct) && !a.cr.unroundedPct.eq(b.cr.unroundedPct)) {
      return true
    }
  }
  return false
}

/**
 * §9.5. CR-range sweeps: the step is finer than the terms' CR precision.
 * Currency sweeps: consecutive points round to the same CR.
 */
function isStaircase(terms: Terms, spec: SweepSpec, points: SweepPoint[]): boolean {
  if (terms.unit !== 'costRatio' || !points.some((p) => p.result.ok)) return false
  if (spec.kind === 'crRange' && D(spec.step).lt(D(1).div(D(10).pow(terms.crPrecision)))) return true
  return hasRepeatedRoundedCR(points)
}

/**
 * Sweeps one input across a range for each set of terms (§9). Returns issues
 * when the sweep itself can't run (no terms, missing component, bad range);
 * per-point problems, including invalid terms, become invalid points instead.
 */
export function runSweep(
  baseline: AmountSet,
  termsList: Terms[],
  spec: SweepSpec,
  ctx: CalcContext,
): SweepResult {
  if (termsList.length === 0) return invalid('noTerms', ['terms'])
  const xs = buildRange(baseline, spec, ctx.minorUnits)
  if (isInvalid(xs)) return xs

  const amountsAt = xs.map((x) => evaluateAmountSet(baseline, ctx.minorUnits, overrideFor(spec, x)))
  const series = termsList.map((terms): SweepSeries => {
    const termIssues = validateTerms(terms, ctx.minorUnits)
    const points = xs.map((x, i) => ({ x, result: settleChecked(terms, termIssues, amountsAt[i], ctx) }))
    return { termsId: terms.id, points, staircase: isStaircase(terms, spec, points) }
  })

  return { ok: true, axis: spec.kind === 'crRange' ? 'costRatio' : 'currency', xs, series }
}
