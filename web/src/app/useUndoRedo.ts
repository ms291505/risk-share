import { useCallback } from 'react'
import { selectCanRedo, selectCanUndo, useWorkspaceStore } from '../state/store'
import { useAnnounce } from './announcer'

/** Undo/redo actions that announce what they did (§13.4). */
export function useUndoRedo() {
  const canUndo = useWorkspaceStore(selectCanUndo)
  const canRedo = useWorkspaceStore(selectCanRedo)
  const announce = useAnnounce()
  const undo = useCallback(() => {
    const label = useWorkspaceStore.getState().undo()
    if (label) announce(`Undid: ${label}`)
  }, [announce])
  const redo = useCallback(() => {
    const label = useWorkspaceStore.getState().redo()
    if (label) announce(`Redid: ${label}`)
  }, [announce])
  return { undo, redo, canUndo, canRedo }
}
