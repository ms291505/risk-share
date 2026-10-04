import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'
import { create } from 'zustand'
import { emptyWorkspace, type Workspace } from './workspace'

enablePatches()

/** §12.4 requires at least 100; 200 leaves headroom for multi-step actions. */
export const HISTORY_LIMIT = 200

export interface HistoryEntry {
  /** Short description for announcements, e.g. "Rename terms". */
  label: string
  patches: Patch[]
  inverse: Patch[]
}

/** Mutates the draft, or returns a whole new workspace (e.g. import or "Show me"). */
export type WorkspaceRecipe = (draft: Draft<Workspace>) => void | Workspace

export interface WorkspaceState {
  workspace: Workspace
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** Set while another tab is the editor (§11.1): changes and undo/redo are ignored. */
  readOnly: boolean
  /**
   * Applies an undoable change (§12.3). Text fields call this once per edit,
   * when the field loses focus or Enter is pressed (§12.5), not per keystroke.
   */
  update(label: string, recipe: WorkspaceRecipe): void
  /**
   * Replaces the workspace and clears the history, without an undo step. For
   * loading from browser storage and migration (§11.1–11.2). Undoable
   * replacements (import, "Show me") use `update` returning the new workspace.
   */
  load(workspace: Workspace): void
  setReadOnly(readOnly: boolean): void
  /** Returns the label of the undone step, or null if nothing was undone. */
  undo(): string | null
  /** Returns the label of the redone step, or null if nothing was redone. */
  redo(): string | null
}

// Persistence and the single-active-tab lock (§11.1) will hook in via useWorkspaceStore.subscribe.
export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspace: emptyWorkspace(),
  past: [],
  future: [],
  readOnly: false,

  update(label, recipe) {
    if (get().readOnly) return
    const [workspace, patches, inverse] = produceWithPatches(get().workspace, recipe)
    if (patches.length === 0) return
    set((s) => ({
      workspace,
      past: [...s.past, { label, patches, inverse }].slice(-HISTORY_LIMIT),
      future: [],
    }))
  },

  load(workspace) {
    set({ workspace, past: [], future: [] })
  },

  setReadOnly(readOnly) {
    set({ readOnly })
  },

  undo() {
    const { past, future, workspace, readOnly } = get()
    const entry = past.at(-1)
    if (!entry || readOnly) return null
    set({
      workspace: applyPatches(workspace, entry.inverse),
      past: past.slice(0, -1),
      future: [entry, ...future],
    })
    return entry.label
  },

  redo() {
    const { past, future, workspace, readOnly } = get()
    const entry = future[0]
    if (!entry || readOnly) return null
    set({
      workspace: applyPatches(workspace, entry.patches),
      past: [...past, entry],
      future: future.slice(1),
    })
    return entry.label
  },
}))

export const selectCanUndo = (s: WorkspaceState) => s.past.length > 0 && !s.readOnly
export const selectCanRedo = (s: WorkspaceState) => s.future.length > 0 && !s.readOnly
