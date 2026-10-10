import type Big from 'big.js'
import { decimalPlaces, HUNDRED, parseDecimal, roundToMinor, toDecimalString, ZERO } from './decimal'
import type {
  AmountComponent,
  AmountGroup,
  AmountSet,
  AmountTotals,
  DecimalString,
  Invalid,
  Issue,
} from './types'

/** Replaces one input of an amount set, for sweeps (§9). Values are already rounded to minor units. */
export type AmountOverride =
  /** Counterparty-paid stays at its baseline, so points below it are invalid gaps (agreed with the user). */
  | { kind: 'additions'; value: Big }
  | { kind: 'deductions'; value: Big }
  | { kind: 'component'; group: 'additions' | 'deductions'; componentId: string; value: Big }
  /** Holds additions fixed and derives total deductions from a CR percentage (§9.3). */
  | { kind: 'costRatio'; pct: Big }

type ComponentOverride = { componentId: string; value: Big }

export type AmountResult = { ok: true; totals: AmountTotals } | Invalid

/** Parses a currency amount, checking it has no more decimals than the currency's minor unit. */
export function parseAmount(
  s: string | undefined,
  minorUnits: number,
  path: string[],
  issues: Issue[],
): Big | null {
  const x = parseDecimal(s)
  if (x === null) {
    issues.push({ code: 'invalidNumber', path })
    return null
  }
  if (decimalPlaces(x) > minorUnits) {
    issues.push({ code: 'tooManyDecimals', path, params: { max: minorUnits } })
    return null
  }
  return x
}

export interface GroupTotalOptions {
  key: 'additions' | 'deductions'
  minorUnits: number
  /** Out-param: every invalid active value is reported here. */
  issues: Issue[]
  override?: ComponentOverride
}

/** Total of one group's active mode, or null if any active value is invalid. */
export function groupTotal(group: AmountGroup, opts: GroupTotalOptions): Big | null {
  const { key, minorUnits, issues, override } = opts
  if (group.mode === 'total') {
    return parseAmount(group.total, minorUnits, [key, 'total'], issues)
  }
  let sum: Big | null = ZERO
  for (const c of group.components) {
    const x =
      override?.componentId === c.id
        ? override.value
        : parseAmount(c.amount, minorUnits, [key, 'components', c.id, 'amount'], issues)
    sum = x === null || sum === null ? null : sum.plus(x)
  }
  return sum
}

/** The components' sum, for switching to a total (§4.3), or null if any amount is invalid. */
export function sumComponents(
  components: AmountComponent[],
  minorUnits: number,
): DecimalString | null {
  const group: AmountGroup = { mode: 'components', total: '', components }
  const sum = groupTotal(group, { key: 'additions', minorUnits, issues: [] })
  return sum && toDecimalString(sum, minorUnits)
}

/**
 * Total additions split into the counterparty-paid part and the rest, for
 * switching to components (§4.3). Null unless both are valid amounts with
 * 0 < paid ≤ total; `rest` is null when the counterparty paid all of it.
 */
export function splitCounterpartyPaid(
  total: DecimalString,
  paid: DecimalString | undefined,
  minorUnits: number,
): { paid: DecimalString; rest: DecimalString | null } | null {
  const t = parseAmount(total, minorUnits, [], [])
  const p = parseAmount(paid, minorUnits, [], [])
  if (!t || !p || p.lte(0) || p.gt(t)) return null
  return { paid: paid!, rest: p.eq(t) ? null : toDecimalString(t.minus(p), minorUnits) }
}

/**
 * §4.6. In components mode this relies on `groupTotal` over the same
 * components to report invalid amounts, so it returns null without an issue.
 */
function counterpartyPaid(
  set: AmountSet,
  minorUnits: number,
  issues: Issue[],
  override?: ComponentOverride,
): Big | null {
  const add = set.additions
  if (add.mode === 'total') {
    if (add.paidByCounterparty === undefined || add.paidByCounterparty === '') return ZERO
    return parseAmount(add.paidByCounterparty, minorUnits, ['additions', 'paidByCounterparty'], issues)
  }
  let sum = ZERO
  for (const c of add.components) {
    if (!c.paidByCounterparty) continue
    const x = override?.componentId === c.id ? override.value : parseDecimal(c.amount)
    if (x === null) return null
    sum = sum.plus(x)
  }
  return sum
}

/** Checks the cross-field rules of §4.5–4.6 on computed totals. */
export function checkTotals(totals: AmountTotals): Issue[] {
  const issues: Issue[] = []
  if (totals.additions.lte(0)) {
    issues.push({ code: 'additionsNotPositive', path: ['additions'] })
  } else if (totals.counterpartyPaid.lt(0) || totals.counterpartyPaid.gt(totals.additions)) {
    issues.push({ code: 'counterpartyPaidOutOfRange', path: ['additions', 'paidByCounterparty'] })
  }
  return issues
}

export function makeTotals(additions: Big, deductions: Big, counterpartyPaid: Big): AmountTotals {
  return { additions, deductions, gainLoss: additions.minus(deductions), counterpartyPaid }
}

/** Totals for an amount set (§4), using only the active mode of each group. */
export function evaluateAmountSet(
  set: AmountSet,
  minorUnits: number,
  override?: AmountOverride,
): AmountResult {
  const issues: Issue[] = []
  const compOverride = (group: 'additions' | 'deductions') =>
    override?.kind === 'component' && override.group === group ? override : undefined

  const additions =
    override?.kind === 'additions'
      ? override.value
      : groupTotal(set.additions, {
          key: 'additions',
          minorUnits,
          issues,
          override: compOverride('additions'),
        })

  let deductions: Big | null = null
  if (override?.kind === 'deductions') {
    deductions = override.value
  } else if (override?.kind === 'costRatio') {
    if (additions !== null) {
      deductions = roundToMinor(additions.times(override.pct).div(HUNDRED), minorUnits)
    }
  } else {
    deductions = groupTotal(set.deductions, {
      key: 'deductions',
      minorUnits,
      issues,
      override: compOverride('deductions'),
    })
  }

  const cp = counterpartyPaid(set, minorUnits, issues, compOverride('additions'))

  if (additions === null || deductions === null || cp === null) return { ok: false, issues }
  const totals = makeTotals(additions, deductions, cp)
  issues.push(...checkTotals(totals))
  return issues.length ? { ok: false, issues } : { ok: true, totals }
}
