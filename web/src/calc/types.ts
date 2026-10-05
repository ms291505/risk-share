import type Big from 'big.js'

/** A canonical decimal string: optional `-`, digits, optional `.digits` (e.g. "1000000.00", "85.0"). */
export type DecimalString = string

export type RoundingMode = 'halfUp' | 'halfEven' | 'truncate'
export type ThresholdUnit = 'costRatio' | 'currency'
export type TermsType = 'gain' | 'loss' | 'full'
export type SideKey = 'gain' | 'loss'
export type PartyRole = 'riskBearer' | 'counterparty'

// ---------------------------------------------------------------------------
// Amount sets (§4)

export interface AmountComponent {
  id: string
  name: string
  amount: DecimalString
  /** Additions only (§4.6). */
  paidByCounterparty?: boolean
}

export interface AmountGroup {
  mode: 'total' | 'components'
  total: DecimalString
  /** Kept while in total mode, but inactive (§4.3). */
  components: AmountComponent[]
}

export interface AdditionsGroup extends AmountGroup {
  /** Total mode only: optional amount of the additions paid by the counterparty (§4.6). */
  paidByCounterparty?: DecimalString
}

export interface AmountSet {
  id: string
  name: string
  additions: AdditionsGroup
  deductions: AmountGroup
}

// ---------------------------------------------------------------------------
// Terms (§6)

export interface Tier {
  id: string
  name: string
  /** CR percentage (cost ratio terms) or non-negative currency amount (currency terms). */
  threshold: DecimalString
  /** 0–100, up to 2 decimals. */
  sharePct: DecimalString
}

export type MinimumBehavior = 'allOrNothing' | 'deductible'

export interface SideLimits {
  maxPayout?: DecimalString
  /** 0–100, up to 2 decimals. */
  maxPayoutPctOfAdditions?: DecimalString
  minimum?: { amount: DecimalString; behavior: MinimumBehavior }
}

export interface Side {
  /** Ordered moving away from break-even. */
  tiers: Tier[]
  limits: SideLimits
}

export interface Terms {
  id: string
  name: string
  unit: ThresholdUnit
  type: TermsType
  /** Decimal places of the CR percentage (default 1). */
  crPrecision: number
  roundingMode: RoundingMode
  /** Sides not used by `type` may be kept but are ignored. */
  gain?: Side
  loss?: Side
}

export interface Parties {
  riskBearer: string
  counterparty: string
}

export interface CalcContext {
  /** Digits after the decimal point for the workspace currency (2 for USD, 0 for JPY). */
  minorUnits: number
}

// ---------------------------------------------------------------------------
// Issues, warnings, results

export type IssueCode =
  | 'invalidNumber'
  | 'tooManyDecimals'
  | 'additionsNotPositive'
  | 'counterpartyPaidOutOfRange'
  | 'invalidPrecision'
  | 'missingSide'
  | 'noTiers'
  | 'gainThresholdAbove100'
  | 'lossThresholdBelow100'
  | 'thresholdNegative'
  | 'thresholdsNotOrdered'
  | 'shareOutOfRange'
  | 'negativeAmount'
  | 'pctOutOfRange'
  | 'maxPayoutBelowMinimum'
  | 'componentNotFound'
  | 'componentInactive'
  | 'noTerms'
  | 'invalidStep'
  | 'invalidRange'
  | 'rangeBelowZero'
  | 'rangeAboveAdditions'
  // Workspace names (§3.3, §8.2), validated in state/names.ts.
  | 'nameEmpty'
  | 'nameTooLong'
  | 'partyNamesSame'
  | 'tooManyPoints'

export interface Issue {
  code: IssueCode
  /** Set when issues from several objects are combined (e.g. by `settle`). */
  source?: 'terms' | 'amountSet' | 'sweep'
  /** Field path, using ids for list items, e.g. ['gain', 'tiers', '<tierId>', 'threshold']. */
  path: string[]
  params?: Record<string, string | number>
}

export interface Warning {
  code: 'capBelowMinimum'
  side: SideKey
  cap: Big
  minimum: Big
}

export type Hint = 'noCounterpartyPaidAdditions'

export interface AmountTotals {
  additions: Big
  deductions: Big
  /** additions − deductions; positive is a gain. */
  gainLoss: Big
  counterpartyPaid: Big
}

export interface CostRatio {
  /** Display only: deductions ÷ additions × 100 to many decimals. Never used to settle. */
  unroundedPct: Big
  /** The CR percentage rounded to `precision` decimals with `mode`. */
  roundedPct: Big
  precision: number
  mode: RoundingMode
}

export type TraceStep =
  | { kind: 'totals'; additions: Big; deductions: Big; gainLoss: Big }
  | { kind: 'costRatio'; cr: CostRatio }
  | { kind: 'side'; side: SideKey | 'none' }
  | {
      kind: 'tier'
      side: SideKey
      tierId: string
      name: string
      /** Threshold where the band starts (nearest break-even). */
      from: Big
      /** Next threshold, or null for the open-ended last band. */
      to: Big | null
      sharePct: Big
      /** Part of the band reached, in CR points or currency. */
      width: Big
      amount: Big
    }
  | { kind: 'tieredTotal'; amount: Big }
  | { kind: 'minimum'; behavior: MinimumBehavior; minimum: Big; before: Big; after: Big }
  | {
      kind: 'cap'
      cap: 'currency' | 'pctOfAdditions'
      pct?: Big
      limit: Big
      before: Big
      after: Big
    }
  /** §6.3.4, §7.4: shown in show-the-math after the caps; also listed in `Settlement.warnings`. */
  | { kind: 'warning'; warning: Warning }
  | { kind: 'rounding'; before: Big; after: Big; minorUnits: number }
  | { kind: 'result'; amount: Big; payer: PartyRole | null; payee: PartyRole | null }

export interface NetPositions {
  riskBearer: Big
  counterparty: Big
  hints: Hint[]
}

export interface Settlement {
  ok: true
  totals: AmountTotals
  cr: CostRatio
  side: SideKey | 'none'
  /** Final, rounded, ≥ 0. */
  amount: Big
  payer: PartyRole | null
  payee: PartyRole | null
  /** Positive: risk-bearer pays counterparty; negative: counterparty pays risk-bearer (§6.1.6). */
  signed: Big
  net: NetPositions
  trace: TraceStep[]
  /** Only for the side being settled. */
  warnings: Warning[]
}

/*
 * Error handling conventions:
 * - Field parsers (`parseAmount`, `groupTotal`) push into an `issues` out-param
 *   and return null, so one pass can report every bad field.
 * - Orchestration functions return `T | Invalid` (see `isInvalid` in result.ts).
 * - Functions that require validated input throw only on programmer error.
 */
export interface Invalid {
  ok: false
  issues: Issue[]
}

export type SettleResult = Settlement | Invalid
