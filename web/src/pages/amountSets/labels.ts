import type { AmountComponent, AmountSet, Issue } from '../../calc'
import { issueMessage } from '../../format/issues'
import type { GroupKey } from '../../state/amountSets'

export const GROUP_LABELS: Record<GroupKey, string> = { additions: 'Additions', deductions: 'Deductions' }

/** Names a component in labels such as "Amount, Rent rebate", even before it has a name. */
export function componentLabel(component: AmountComponent, index: number): string {
  return component.name.trim() || `component ${index + 1}`
}

/** The message of the issue at exactly `path`, for an inline error. */
export function messageAt(issues: Issue[], ...path: string[]): string | null {
  const issue = issues.find((i) => i.path.length === path.length && i.path.every((p, n) => p === path[n]))
  return issue ? issueMessage(issue) : null
}

/** An issue with the field it's on, for a list away from the fields, e.g. "Deductions, Claims: Enter a number." */
export function describeIssue(set: AmountSet, issue: Issue): string {
  const [key, field, componentId] = issue.path as [GroupKey | undefined, string | undefined, string | undefined]
  const message = issueMessage(issue)
  if (!key || !field) return message
  if (field === 'total') return `Total ${GROUP_LABELS[key].toLowerCase()}: ${message}`
  if (field === 'paidByCounterparty') return `Paid by counterparty: ${message}`
  const components = set[key].components
  const index = components.findIndex((c) => c.id === componentId)
  return index < 0 ? message : `${GROUP_LABELS[key]}, ${componentLabel(components[index], index)}: ${message}`
}
