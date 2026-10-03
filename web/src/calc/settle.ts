import type Big from 'big.js'
import { evaluateAmountSet, type AmountOverride, type AmountResult } from './amounts'
import { computeCR } from './costRatio'
import { roundToMinor, ZERO } from './decimal'
import { applyLimits, capBelowMinimum } from './limits'
import { netPositions } from './netPosition'
import { withSource } from './result'
import { activeSides } from './terms'
import { tieredAmount } from './tiers'
import type {
  AmountSet,
  AmountTotals,
  CalcContext,
  Issue,
  PartyRole,
  SettleResult,
  Settlement,
  Terms,
  TraceStep,
  Warning,
} from './types'
import { validateTerms } from './validateTerms'

/**
 * Settles terms against totals (§6.2): tiered amount → minimum → caps →
 * round to the minor unit. Callers must validate first: the terms with
 * `validateTerms`, the totals with `checkTotals`. Not exported from index.ts.
 */
export function settleValidated(terms: Terms, totals: AmountTotals, ctx: CalcContext): Settlement {
  const cr = computeCR(totals.additions, totals.deductions, terms.crPrecision, terms.roundingMode)
  const trace: TraceStep[] = [
    { kind: 'totals', additions: totals.additions, deductions: totals.deductions, gainLoss: totals.gainLoss },
    { kind: 'costRatio', cr },
  ]

  // At most one side is beyond its first threshold: validation keeps the sides apart.
  const inPlay = activeSides(terms)
    .map((key) => ({ key, tiered: tieredAmount(key, terms[key]!, terms.unit, totals, cr.roundedPct) }))
    .find((s) => s.tiered.inPlay)

  const warnings: Warning[] = []
  let amount: Big = ZERO
  if (!inPlay) {
    trace.push({ kind: 'side', side: 'none' })
  } else {
    const { limits } = terms[inPlay.key]!
    const limited = applyLimits(inPlay.tiered.amount, limits, totals.additions)
    const warning = capBelowMinimum(inPlay.key, limits, totals.additions)
    if (warning) warnings.push(warning)
    amount = roundToMinor(limited.amount, ctx.minorUnits)
    trace.push(
      { kind: 'side', side: inPlay.key },
      ...inPlay.tiered.steps,
      ...limited.steps,
      ...warnings.map((w): TraceStep => ({ kind: 'warning', warning: w })),
      { kind: 'rounding', before: limited.amount, after: amount, minorUnits: ctx.minorUnits },
    )
  }

  const side = inPlay?.key ?? 'none'
  let payer: PartyRole | null = null
  let payee: PartyRole | null = null
  if (amount.gt(0)) {
    payer = side === 'gain' ? 'riskBearer' : 'counterparty'
    payee = side === 'gain' ? 'counterparty' : 'riskBearer'
  }
  trace.push({ kind: 'result', amount, payer, payee })

  const signed = side === 'loss' ? amount.neg() : amount
  return {
    ok: true,
    totals,
    cr,
    side,
    amount,
    payer,
    payee,
    signed,
    net: netPositions(totals, signed),
    trace,
    warnings,
  }
}

/**
 * Combines already-computed validation results and settles if both are clean.
 * Lets sweeps validate the terms once per series.
 */
export function settleChecked(
  terms: Terms,
  termIssues: Issue[],
  amounts: AmountResult,
  ctx: CalcContext,
): SettleResult {
  const issues = [
    ...withSource(termIssues, 'terms'),
    ...(amounts.ok ? [] : withSource(amounts.issues, 'amountSet')),
  ]
  if (issues.length || !amounts.ok) return { ok: false, issues }
  return settleValidated(terms, amounts.totals, ctx)
}

/** Settles one scenario (terms × amount set). Invalid inputs return their issues (§4.7, §6.4). */
export function settle(
  terms: Terms,
  amountSet: AmountSet,
  ctx: CalcContext,
  override?: AmountOverride,
): SettleResult {
  return settleChecked(
    terms,
    validateTerms(terms, ctx.minorUnits),
    evaluateAmountSet(amountSet, ctx.minorUnits, override),
    ctx,
  )
}
