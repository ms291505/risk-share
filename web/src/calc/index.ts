// Pure calculation core: no React or DOM dependencies.
export type * from './types'
export { D, parseDecimal, isDecimalString, toDecimalString, roundToMinor } from './decimal'
export { minorUnits } from './currency'
export { isInvalid } from './result'
export { activeSides, defaultTierName } from './terms'
export { evaluateAmountSet, type AmountOverride, type AmountResult } from './amounts'
export { computeCR } from './costRatio'
export { settle } from './settle'
export { netPositions } from './netPosition'
export { validateTerms, MAX_CR_PRECISION } from './validateTerms'
export {
  runSweep,
  buildRange,
  MAX_SWEEP_POINTS,
  type SweepSpec,
  type SweepVariable,
  type CurrencyRange,
  type SweepResult,
  type SweepSeries,
  type SweepPoint,
} from './sweep'
export { settlementCurve, type SettlementCurve, type ThresholdMarker } from './curve'
export {
  rescaleAmount,
  rescaleAmountSet,
  rescaleTerms,
  rescaleSweepSpec,
  previewCurrencyChange,
  previewPrecisionChange,
  applyPrecisionChange,
  type ThresholdChange,
} from './rescale'
export { summarizeTerms, intlSummaryFormat, type SummaryFormat } from './summary'
export { templateTerms, blankTerms, type TemplateKind } from './templates'
