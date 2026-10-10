import {
  parseAmount,
  splitCounterpartyPaid,
  sumComponents,
  type AdditionsGroup,
  type AmountComponent,
  type AmountGroup,
  type AmountSet,
  type DecimalString,
} from '../calc'
import type { SavedSweep, Scenario, Workspace } from './workspace'

export type GroupKey = 'additions' | 'deductions'

const newId = () => crypto.randomUUID()

/** "‹prefix› N" with the lowest N no existing item's name uses. */
function nextDefaultName(prefix: string, existing: { name: string }[]): string {
  const used = new Set(existing.map((item) => item.name.trim()))
  let n = 1
  while (used.has(`${prefix} ${n}`)) n++
  return `${prefix} ${n}`
}

/** Both groups start as a total of 0, so the set is invalid until filled in (§4.7). */
export function newAmountSet(existing: AmountSet[]): AmountSet {
  return {
    id: newId(),
    name: nextDefaultName('Amount set', existing),
    additions: { mode: 'total', total: '0', components: [] },
    deductions: { mode: 'total', total: '0', components: [] },
  }
}

/** A copy with new ids, to insert right after the original (§8.5). */
export function duplicateAmountSet(set: AmountSet): AmountSet {
  const copyComponents = (components: AmountComponent[]) => components.map((c) => ({ ...c, id: newId() }))
  return {
    ...set,
    id: newId(),
    name: `${set.name} (copy)`,
    additions: { ...set.additions, components: copyComponents(set.additions.components) },
    deductions: { ...set.deductions, components: copyComponents(set.deductions.components) },
  }
}

export function newComponent(existing: AmountComponent[]): AmountComponent {
  return {
    id: newId(),
    name: nextDefaultName('Component', existing),
    amount: '0',
  }
}

export interface DeleteImpact {
  /** Deleted along with the amount set. */
  scenarios: Scenario[]
  /** Kept, but they need repair until another baseline is picked (§9.7). */
  sweeps: SavedSweep[]
}

/** What deleting an amount set affects, for the confirmation (§8.6). */
export function deleteImpact(workspace: Workspace, id: string): DeleteImpact {
  return {
    scenarios: workspace.scenarios.filter((s) => s.amountSetId === id),
    sweeps: workspace.sweeps.filter((s) => s.baselineAmountSetId === id),
  }
}

/** Deletes an amount set and its scenarios, in an `update` recipe. */
export function deleteAmountSet(workspace: Workspace, id: string): void {
  workspace.amountSets = workspace.amountSets.filter((s) => s.id !== id)
  workspace.scenarios = workspace.scenarios.filter((s) => s.amountSetId !== id)
}

/**
 * Turns a total into components (§4.3): one equal to the total, or for
 * additions with an amount paid by the counterparty, that amount as its own
 * marked component plus the rest, so both numbers are kept. Any components
 * stored alongside the total (only imported files have them) are replaced.
 */
export function splitIntoComponents(
  set: AmountSet,
  key: GroupKey,
  minorUnits: number,
  counterparty: string,
): AmountSet {
  const group = set[key]
  if (group.mode === 'components') return set
  const components =
    key === 'additions'
      ? splitAdditions(set.additions, minorUnits, counterparty)
      : [totalComponent(group.total, minorUnits)]
  return { ...set, [key]: { ...group, mode: 'components', components } }
}

export interface ComponentTotals {
  /** Null if an amount can't be read. */
  total: DecimalString | null
  /** The components marked as paid by the counterparty (additions only). */
  paid: DecimalString | null
}

export function componentTotals(group: AmountGroup, minorUnits: number): ComponentTotals {
  const marked = group.components.filter((c) => c.paidByCounterparty)
  return { total: sumComponents(group.components, minorUnits), paid: sumComponents(marked, minorUnits) }
}

/**
 * Removes the components and uses their sum as the total (§4.3), blank if
 * it can't be worked out. For additions, the counterparty-paid amount becomes
 * the sum of the marked components, or blank if none are marked.
 */
export function replaceComponentsWithTotal(set: AmountSet, key: GroupKey, minorUnits: number): AmountSet {
  const { total, paid } = componentTotals(set[key], minorUnits)
  const group = { ...set[key], mode: 'total' as const, total: total ?? '', components: [] }
  if (key === 'deductions') return { ...set, deductions: group }
  const anyMarked = set.additions.components.some((c) => c.paidByCounterparty)
  return { ...set, additions: { ...group, paidByCounterparty: anyMarked ? (paid ?? '') : undefined } }
}

/** The total as one component, blank if it can't be read. */
function totalComponent(total: string, minorUnits: number): AmountComponent {
  const readable = parseAmount(total, minorUnits, [], []) !== null
  return { id: newId(), name: 'Component 1', amount: readable ? total : '' }
}

function splitAdditions(additions: AdditionsGroup, minorUnits: number, counterparty: string): AmountComponent[] {
  const split = splitCounterpartyPaid(additions.total, additions.paidByCounterparty, minorUnits)
  if (!split) return [totalComponent(additions.total, minorUnits)]
  const paid = { id: newId(), name: `Paid by ${counterparty}`, amount: split.paid, paidByCounterparty: true }
  return split.rest === null ? [paid] : [paid, { id: newId(), name: 'Other additions', amount: split.rest }]
}
