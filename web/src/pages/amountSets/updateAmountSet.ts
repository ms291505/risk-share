import type { Draft } from 'immer'
import type { AmountSet } from '../../calc'
import { useWorkspaceStore } from '../../state/store'

export const amountSetPath = (id: string) => `/amounts/${id}`

/** An undoable change to one amount set. The recipe mutates it, or returns a replacement. */
export function updateAmountSet(id: string, label: string, recipe: (set: Draft<AmountSet>) => void | AmountSet): void {
  useWorkspaceStore.getState().update(label, (w) => {
    const index = w.amountSets.findIndex((s) => s.id === id)
    if (index < 0) return
    const replacement = recipe(w.amountSets[index])
    if (replacement) w.amountSets[index] = replacement
  })
}
