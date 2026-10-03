import type Big from 'big.js'
import { decimalPlaces, parseDecimal, round, roundToMinor, toDecimalString } from './decimal'
import type { SweepSpec } from './sweep'
import type { AmountGroup, AmountSet, DecimalString, Side, SideKey, Terms } from './types'

type Rescale = (s: DecimalString) => DecimalString

/**
 * Rounds a stored currency amount half up to a new minor unit (§2.3); halves
 * round away from zero, so −0.5 → −1. Unparsable values are left for
 * validation to report.
 */
export function rescaleAmount(s: DecimalString, newMinorUnits: number): DecimalString {
  const x = parseDecimal(s)
  return x === null ? s : toDecimalString(roundToMinor(x, newMinorUnits), newMinorUnits)
}

// Every stored currency amount, active or not. The collectors (for counting)
// and mappers (for rescaling) must list the same fields.

function groupAmounts(g: AmountGroup): DecimalString[] {
  return [g.total, ...g.components.map((c) => c.amount)]
}

function amountSetAmounts(set: AmountSet): DecimalString[] {
  const cp = set.additions.paidByCounterparty
  return [...groupAmounts(set.additions), ...(cp ? [cp] : []), ...groupAmounts(set.deductions)]
}

function sideAmounts(terms: Terms, side: Side | undefined): DecimalString[] {
  if (!side) return []
  const { maxPayout, minimum } = side.limits
  return [
    ...(terms.unit === 'currency' ? side.tiers.map((t) => t.threshold) : []),
    ...(maxPayout ? [maxPayout] : []),
    ...(minimum ? [minimum.amount] : []),
  ]
}

function termsAmounts(terms: Terms): DecimalString[] {
  return [...sideAmounts(terms, terms.gain), ...sideAmounts(terms, terms.loss)]
}

function sweepAmounts(spec: SweepSpec): DecimalString[] {
  return spec.kind === 'variable' && spec.range.kind === 'minMaxStep'
    ? [spec.range.min, spec.range.max, spec.range.step]
    : []
}

function mapGroup<G extends AmountGroup>(g: G, f: Rescale): G {
  return { ...g, total: f(g.total), components: g.components.map((c) => ({ ...c, amount: f(c.amount) })) }
}

/** How many stored amounts change value when the currency's minor unit changes (§2.3 confirmation). */
export function previewCurrencyChange(
  newMinorUnits: number,
  data: { amountSets?: AmountSet[]; terms?: Terms[]; sweeps?: SweepSpec[] },
): { rounded: number } {
  const all = [
    ...(data.amountSets ?? []).flatMap(amountSetAmounts),
    ...(data.terms ?? []).flatMap(termsAmounts),
    ...(data.sweeps ?? []).flatMap(sweepAmounts),
  ]
  const rounded = all.filter((s) => {
    const x = parseDecimal(s)
    return x !== null && decimalPlaces(x) > newMinorUnits
  }).length
  return { rounded }
}

export function rescaleAmountSet(set: AmountSet, newMinorUnits: number): AmountSet {
  const f: Rescale = (s) => rescaleAmount(s, newMinorUnits)
  const additions = mapGroup(set.additions, f)
  if (set.additions.paidByCounterparty) additions.paidByCounterparty = f(set.additions.paidByCounterparty)
  return { ...set, additions, deductions: mapGroup(set.deductions, f) }
}

export function rescaleTerms(terms: Terms, newMinorUnits: number): Terms {
  const f: Rescale = (s) => rescaleAmount(s, newMinorUnits)
  const mapSide = (side: Side | undefined): Side | undefined =>
    side && {
      tiers: side.tiers.map((t) => (terms.unit === 'currency' ? { ...t, threshold: f(t.threshold) } : t)),
      limits: {
        ...side.limits,
        ...(side.limits.maxPayout && { maxPayout: f(side.limits.maxPayout) }),
        ...(side.limits.minimum && {
          minimum: { ...side.limits.minimum, amount: f(side.limits.minimum.amount) },
        }),
      },
    }
  return { ...terms, gain: mapSide(terms.gain), loss: mapSide(terms.loss) }
}

/** Rounds a saved sweep's currency range. A step that rounds to 0 is then reported by the sweep. */
export function rescaleSweepSpec(spec: SweepSpec, newMinorUnits: number): SweepSpec {
  if (spec.kind !== 'variable' || spec.range.kind !== 'minMaxStep') return spec
  const f: Rescale = (s) => rescaleAmount(s, newMinorUnits)
  const { min, max, step } = spec.range
  return { ...spec, range: { ...spec.range, min: f(min), max: f(max), step: f(step) } }
}

export interface ThresholdChange {
  side: SideKey
  tierId: string
  name: string
  from: DecimalString
  to: DecimalString
}

/** CR thresholds rounded half up, like other entered values, to the new precision. */
function roundThreshold(x: Big, precision: number): DecimalString {
  return toDecimalString(round(x, precision, 'halfUp'), precision)
}

/**
 * §5.6: the CR thresholds whose value changes if the precision is lowered
 * (e.g. 85.55 → 85.6). Tiers can collapse onto the same value; run
 * `validateTerms` on `applyPrecisionChange`'s result to show that before confirming.
 */
export function previewPrecisionChange(terms: Terms, newPrecision: number): ThresholdChange[] {
  if (terms.unit !== 'costRatio') return []
  const changes: ThresholdChange[] = []
  for (const side of ['gain', 'loss'] as const) {
    for (const t of terms[side]?.tiers ?? []) {
      const x = parseDecimal(t.threshold)
      if (x === null || decimalPlaces(x) <= newPrecision) continue
      changes.push({ side, tierId: t.id, name: t.name, from: t.threshold, to: roundThreshold(x, newPrecision) })
    }
  }
  return changes
}

/** Sets the CR precision and rewrites CR thresholds at that precision (85.5 → 85.50 when raising it). */
export function applyPrecisionChange(terms: Terms, newPrecision: number): Terms {
  if (terms.unit !== 'costRatio') return { ...terms, crPrecision: newPrecision }
  const mapSide = (side: Side | undefined): Side | undefined =>
    side && {
      ...side,
      tiers: side.tiers.map((t) => {
        const x = parseDecimal(t.threshold)
        return x === null ? t : { ...t, threshold: roundThreshold(x, newPrecision) }
      }),
    }
  return { ...terms, crPrecision: newPrecision, gain: mapSide(terms.gain), loss: mapSide(terms.loss) }
}
