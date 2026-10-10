import { parseAmount, splitCounterpartyPaid, sumComponents, type AmountComponent, type AmountSet } from '../calc'
import type { SavedSweep, Scenario, Workspace } from './workspace'

export type GroupKey = 'additions' | 'deductions'
export type GroupMode = 'total' | 'components'

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
 * Switches additions or deductions between a total and components (§4.3).
 *
 * - To a total: the total becomes the components' sum, and for additions the
 *   counterparty-paid amount becomes the sum of the marked components. The
 *   components are kept, inactive. A sum that can't be worked out leaves the
 *   old value.
 * - To components: kept components come back unchanged. Otherwise the total
 *   becomes one component; for additions with a counterparty-paid amount
 *   below the total, two, so that both numbers are kept.
 */
export function switchGroupMode(set: AmountSet, key: GroupKey, mode: GroupMode, minorUnits: number): AmountSet {
  const group = set[key]
  if (group.mode === mode) return set
  if (mode === 'total') {
    const total = sumComponents(group.components, minorUnits) ?? group.total
    if (key === 'deductions') return { ...set, deductions: { ...set.deductions, mode, total } }
    const marked = set.additions.components.filter((c) => c.paidByCounterparty)
    const paid = marked.length ? (sumComponents(marked, minorUnits) ?? set.additions.paidByCounterparty) : undefined
    return { ...set, additions: { ...set.additions, mode, total, paidByCounterparty: paid } }
  }

  if (group.components.length) return { ...set, [key]: { ...group, mode } }
  const components = key === 'additions' ? splitAdditions(set, minorUnits) : [totalComponent(group.total, minorUnits)]
  return { ...set, [key]: { ...group, mode, components } }
}

/** The total as one component, blank if it can't be read. */
function totalComponent(total: string, minorUnits: number): AmountComponent {
  const readable = parseAmount(total, minorUnits, [], []) !== null
  return { id: newId(), name: 'Component 1', amount: readable ? total : '' }
}

function splitAdditions(set: AmountSet, minorUnits: number): AmountComponent[] {
  const split = splitCounterpartyPaid(set.additions.total, set.additions.paidByCounterparty, minorUnits)
  if (!split) return [totalComponent(set.additions.total, minorUnits)]
  const paid = { id: newId(), name: 'Paid by counterparty', amount: split.paid, paidByCounterparty: true }
  return split.rest === null ? [paid] : [paid, { id: newId(), name: 'Other additions', amount: split.rest }]
}
