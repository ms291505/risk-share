import type { Issue, IssueCode } from '../calc'

type Params = Issue['params']

const MESSAGES: Record<IssueCode, string | ((p: NonNullable<Params>) => string)> = {
  invalidNumber: 'Enter a number.',
  tooManyDecimals: (p) => `Use at most ${p.max} decimal places.`,
  additionsNotPositive: 'Total additions must be greater than zero.',
  counterpartyPaidOutOfRange: 'The counterparty-paid amount must be between zero and total additions.',
  invalidPrecision: 'Cost ratio precision is out of range.',
  missingSide: 'A side these terms need is missing.',
  noTiers: 'Add at least one threshold.',
  gainThresholdAbove100: 'Gain share thresholds must be at most 100%.',
  lossThresholdBelow100: 'Loss share thresholds must be at least 100%.',
  thresholdNegative: 'Thresholds must be zero or more.',
  thresholdsNotOrdered: 'Thresholds must be in order, moving away from break-even.',
  shareOutOfRange: 'Share must be between 0% and 100%.',
  negativeAmount: 'Amount must be zero or more.',
  pctOutOfRange: 'Percentage must be between 0% and 100%.',
  maxPayoutBelowMinimum: 'Max payout must be at least the minimum payout.',
  componentNotFound: 'The swept component no longer exists.',
  componentInactive: 'The swept component is inactive.',
  noTerms: 'Pick at least one set of terms.',
  invalidStep: 'Step must be greater than zero.',
  invalidRange: 'The range start must not be after its end.',
  rangeAboveAdditions: "The range can't include gains larger than the additions.",
  nameEmpty: 'Enter a name.',
  nameTooLong: (p) => `Use at most ${p.max} characters.`,
  partyNamesSame: 'The two parties need different names.',
  tooManyPoints: (p) => `This range has ${p.count} points; the limit is ${p.max}. Increase the step.`,
}

/** A user-facing sentence for a validation issue (§6.4). All validation copy lives here. */
export function issueMessage(issue: Issue): string {
  const m = MESSAGES[issue.code]
  return typeof m === 'string' ? m : m(issue.params ?? {})
}

/** Distinct messages for a list of issues, in order. */
export function issueMessages(issues: Issue[]): string[] {
  return [...new Set(issues.map(issueMessage))]
}
