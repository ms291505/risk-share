import type { Draft } from 'immer'
import type { AmountGroup, AmountSet } from '../../calc'
import type { GroupKey } from '../../state/amountSets'
import { useWorkspaceStore } from '../../state/store'

/** The amount set as it is in the store now, e.g. right after an update. */
export function currentAmountSet(id: string): AmountSet | undefined {
  return useWorkspaceStore.getState().workspace.amountSets.find((s) => s.id === id)
}

/** An undoable change to one amount set. The recipe mutates it, or returns a replacement. */
export function updateAmountSet(id: string, label: string, recipe: (set: Draft<AmountSet>) => void | AmountSet): void {
  useWorkspaceStore.getState().update(label, (w) => {
    const index = w.amountSets.findIndex((s) => s.id === id)
    if (index < 0) return
    const replacement = recipe(w.amountSets[index])
    if (replacement) w.amountSets[index] = replacement
  })
}

/** An undoable change to an amount set's additions or deductions. */
export function updateGroup(id: string, key: GroupKey, label: string, recipe: (group: Draft<AmountGroup>) => void) {
  updateAmountSet(id, label, (set) => recipe(set[key]))
}
