import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'
import { create } from 'zustand'
import { emptyWorkspace, type Workspace } from './workspace'

enablePatches()

/** Undo keeps at least the last 100 steps (§12.4). */
export const HISTORY_LIMIT = 200

export interface HistoryEntry {
  /** Short description for announcements, e.g. "Rename terms". */
  label: string
  patches: Patch[]
  inverse: Patch[]
}

export interface WorkspaceState {
  workspace: Workspace
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** Applies an undoable change to the workspace. All data changes go through here (§12.3). */
  update(label: string, recipe: (draft: Draft<Workspace>) => void): void
  /** Returns the label of the undone step, or null if there was nothing to undo. */
  undo(): string | null
  /** Returns the label of the redone step, or null if there was nothing to redo. */
  redo(): string | null
}

// Persistence and the single-active-tab lock (§11.1) will hook in via useWorkspaceStore.subscribe.
export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspace: emptyWorkspace(),
  past: [],
  future: [],

  update(label, recipe) {
    const [workspace, patches, inverse] = produceWithPatches(get().workspace, recipe)
    if (patches.length === 0) return
    set((s) => ({
      workspace,
      past: [...s.past, { label, patches, inverse }].slice(-HISTORY_LIMIT),
      future: [],
    }))
  },

  undo() {
    const { past, future, workspace } = get()
    const entry = past.at(-1)
    if (!entry) return null
    set({
      workspace: applyPatches(workspace, entry.inverse),
      past: past.slice(0, -1),
      future: [entry, ...future],
    })
    return entry.label
  },

  redo() {
    const { past, future, workspace } = get()
    const entry = future[0]
    if (!entry) return null
    set({
      workspace: applyPatches(workspace, entry.patches),
      past: [...past, entry],
      future: future.slice(1),
    })
    return entry.label
  },
}))

export const selectCanUndo = (s: WorkspaceState) => s.past.length > 0
export const selectCanRedo = (s: WorkspaceState) => s.future.length > 0
