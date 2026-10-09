import { create } from 'zustand'
import type { WorkspaceState } from '../state/store'
import { isEmptyWorkspace, type Workspace } from '../state/workspace'
import { MIGRATIONS } from './migrate'
import { parseWorkspaceText, type LoadError } from './parse'
import { serializeWorkspace } from './serialize'

export const STORAGE_KEY = 'risk-share-workspace'
/** The stored workspace as it was before its last migration (§11.2). */
export const BACKUP_KEY = 'risk-share-workspace-backup'

/**
 * - `ok`: every change is saved.
 * - `full`: the last save failed for lack of space; the next successful one clears it.
 * - `unavailable`: browser storage can't be used (e.g. blocked by settings); the app works in memory.
 * - `blocked`: the stored workspace can't be opened (newer, corrupt or invalid), so it is never overwritten.
 */
export type StorageStatus = 'ok' | 'full' | 'unavailable' | 'blocked'

export interface PersistenceState {
  status: StorageStatus
  /** A pre-migration backup is stored and can be downloaded. */
  hasBackup: boolean
  /** Why the stored workspace couldn't be opened, while `status` is `blocked`. */
  blockedBy: LoadError | null
}

/** Storage status for the UI (§11.1). */
export const usePersistence = create<PersistenceState>()(() => ({ status: 'ok', hasBackup: false, blockedBy: null }))

/** The parts of the workspace store persistence needs. */
interface WorkspaceStore {
  getState(): Pick<WorkspaceState, 'workspace' | 'readOnly' | 'load'>
  subscribe(listener: (state: WorkspaceState, prev: WorkspaceState) => void): () => void
}

export interface Persistence {
  /**
   * Re-reads the stored workspace and loads it if another tab changed it
   * (§11.1). `handedOver` is the text the previous editor tab saved, which
   * can arrive before its write is visible in this tab's storage.
   */
  reload(handedOver?: string | null): void
  /** The stored text: what was saved, or the copy that couldn't be opened. */
  readStored(): string | null
  /** The pre-migration backup, if any. */
  readBackup(): string | null
  /**
   * Gives up on a stored workspace that couldn't be opened, and saves the
   * current one over it. Offer a download of `readStored()` first.
   */
  overwriteBlocked(): void
  stop(): void
}

let active: Persistence | null = null

/** The running persistence, once `startPersistence` has been called. */
export function persistence(): Persistence | null {
  return active
}

/**
 * Loads the stored workspace and saves every change after it (§11.1). Call
 * once, before the first render: the read is synchronous, so the app never
 * shows the welcome view for a workspace that is about to load.
 *
 * Saves are synchronous and not debounced, because edits already commit once
 * per field (§12.5). Nothing is ever written while read-only (another tab is
 * the editor) or while the stored copy is blocked.
 */
export function startPersistence(getStorage: () => Storage, store: WorkspaceStore, migrations = MIGRATIONS): Persistence {
  active?.stop()
  usePersistence.setState({ status: 'ok', hasBackup: false, blockedBy: null })
  const setStatus = (status: StorageStatus) => usePersistence.setState({ status })

  let storage: Storage | null = null
  /** The text last read or written, to skip saving what's already stored. */
  let lastText: string | null = null
  /** An original awaiting backup before its migrated version may be saved over it. */
  let pendingBackup: string | null = null
  let hasSaved = false
  let persistRequested = false

  function requestPersistOnce(workspace: Workspace) {
    if (persistRequested || isEmptyWorkspace(workspace)) return
    persistRequested = true
    requestPersistentStorage()
  }

  function save(workspace: Workspace) {
    if (!storage || store.getState().readOnly || usePersistence.getState().status === 'blocked') return
    const text = serializeWorkspace(workspace, 0)
    // Already stored, e.g. undoing the edit that didn't fit.
    if (text === lastText && pendingBackup === null) return setStatus('ok')
    try {
      if (pendingBackup !== null) {
        storage.setItem(BACKUP_KEY, pendingBackup)
        pendingBackup = null
        usePersistence.setState({ hasBackup: true })
      }
      storage.setItem(STORAGE_KEY, text)
      lastText = text
      hasSaved = true
      setStatus('ok')
    } catch (e) {
      setStatus(isQuotaError(e) ? 'full' : 'unavailable')
    }
    requestPersistOnce(workspace)
  }

  /** Reads and opens the stored workspace, or `given` instead. Returns false if storage can't be read. */
  function read(given?: string | null): boolean {
    let text: string | null
    try {
      storage ??= getStorage()
      text = given ?? storage.getItem(STORAGE_KEY)
      usePersistence.setState({ hasBackup: storage.getItem(BACKUP_KEY) !== null })
    } catch {
      storage = null
      setStatus('unavailable')
      return false
    }
    if (text === null || text === lastText) return true
    const parsed = parseWorkspaceText(text, migrations)
    if (!parsed.ok) {
      usePersistence.setState({ status: 'blocked', blockedBy: parsed.error })
      return true
    }
    if (usePersistence.getState().status === 'blocked') usePersistence.setState({ status: 'ok', blockedBy: null })
    lastText = text
    store.getState().load(parsed.workspace)
    if (parsed.migratedFrom !== undefined) {
      // Keep the original until it's backed up; if that fails, save() leaves it alone.
      pendingBackup = text
      save(parsed.workspace)
    }
    requestPersistOnce(parsed.workspace)
    return true
  }

  const unsubscribe = read()
    ? store.subscribe((state, prev) => {
        if (state.workspace !== prev.workspace) save(state.workspace)
      })
    : () => {}

  const self: Persistence = {
    // Once this tab has saved, its own copy is newer than anything handed over.
    reload: (handedOver) => void read(hasSaved ? undefined : handedOver),
    readStored() {
      try {
        return storage?.getItem(STORAGE_KEY) ?? null
      } catch {
        return null
      }
    },
    readBackup() {
      try {
        return storage?.getItem(BACKUP_KEY) ?? null
      } catch {
        return null
      }
    },
    overwriteBlocked() {
      if (usePersistence.getState().status !== 'blocked' || store.getState().readOnly) return
      usePersistence.setState({ status: 'ok', blockedBy: null })
      save(store.getState().workspace)
    },
    stop() {
      unsubscribe()
      if (active === self) active = null
    },
  }
  active = self
  return self
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    // Firefox used its own name before adopting the standard one.
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * Asks the browser not to evict our storage under pressure. It's only a
 * safety net: exporting is the way to keep a workspace (§11.1). Skipped in
 * Firefox, which asks the user with a permission prompt; there's no feature
 * test for "would prompt", hence the user-agent check. If the check is wrong,
 * the only effect is a skipped or an extra request.
 */
export function requestPersistentStorage(nav: Pick<Navigator, 'userAgent' | 'storage'> = navigator): void {
  if (/Firefox\//.test(nav.userAgent)) return
  nav.storage?.persist?.().catch(() => {})
}
