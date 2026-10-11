import type { AmountComponent, AmountSet, Issue, Parties } from '../../calc'
import type { GroupKey } from '../../state/amountSets'
import { partyName } from '../../format/parties'

export const GROUP_LABELS: Record<GroupKey, string> = { additions: 'Additions', deductions: 'Deductions' }

/** "Paid by Bob": counterparty-paid amounts are labeled with the counterparty's name (§3.2). */
export const paidByLabel = (parties: Parties) => `Paid by ${partyName(parties, 'counterparty')}`

/** Names a component in labels such as "Amount, Rent rebate", even before it has a name. */
export function componentLabel(component: AmountComponent, index: number): string {
  return component.name.trim() || `component ${index + 1}`
}

/** The issue at exactly `path`, for an inline error. */
export function issueAt(issues: Issue[], ...path: string[]): Issue | undefined {
  return issues.find((i) => i.path.length === path.length && i.path.every((p, n) => p === path[n]))
}

/**
 * The field an issue is on, for listing it away from the fields, e.g.
 * "Deductions, Claims". Null for an issue about a whole group.
 */
export function issueField(set: AmountSet, issue: Issue): string | null {
  const [key, field, componentId] = issue.path as [GroupKey | undefined, string | undefined, string | undefined]
  if (!key || !field) return null
  if (field === 'total') return `Total ${GROUP_LABELS[key].toLowerCase()}`
  const components = set[key].components
  const index = components.findIndex((c) => c.id === componentId)
  return index < 0 ? null : `${GROUP_LABELS[key]}, ${componentLabel(components[index], index)}`
}
