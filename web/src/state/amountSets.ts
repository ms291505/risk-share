import {
  parseAmount,
  sumComponents,
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
 * Turns a total into components (§4.3), starting with one equal to the
 * total. Any components stored alongside the total (only imported files
 * have them) are replaced.
 */
export function splitIntoComponents(set: AmountSet, key: GroupKey, minorUnits: number): AmountSet {
  const group = set[key]
  if (group.mode === 'components') return set
  const readable = parseAmount(group.total, minorUnits, [], []) !== null
  const component = { id: newId(), name: 'Component 1', amount: readable ? group.total : '' }
  return { ...set, [key]: { ...group, mode: 'components', components: [component] } }
}

export interface ComponentTotals {
  /** Null if an amount can't be read. */
  total: DecimalString | null
  /** The components marked as paid by the counterparty (additions only, §4.6). */
  paid: DecimalString | null
}

export function componentTotals(group: AmountGroup, minorUnits: number): ComponentTotals {
  const marked = group.components.filter((c) => c.paidByCounterparty)
  return { total: sumComponents(group.components, minorUnits), paid: sumComponents(marked, minorUnits) }
}

/**
 * Removes the components and uses their sum as the total (§4.3), blank if it
 * can't be worked out. A total has no counterparty-paid amount (§4.6), so
 * what the marked components recorded is dropped.
 */
export function replaceComponentsWithTotal(set: AmountSet, key: GroupKey, minorUnits: number): AmountSet {
  const total = componentTotals(set[key], minorUnits).total ?? ''
  return { ...set, [key]: { mode: 'total', total, components: [] } }
}
