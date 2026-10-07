import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { templateTerms } from '../calc'
import { useWorkspaceStore } from '../state/store'
import { emptyWorkspace, SCHEMA_VERSION, type Workspace } from '../state/workspace'
import { BACKUP_KEY, requestPersistentStorage, startPersistence, STORAGE_KEY, usePersistence } from './persistence'
import { serializeWorkspace } from './serialize'

/** A Map-backed Storage whose writes can be made to fail. */
class FakeStorage implements Storage {
  data = new Map<string, string>()
  writes: string[] = []
  failWrites: ((key: string) => Error | undefined) | null = null
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    const error = this.failWrites?.(key)
    if (error) throw error
    this.writes.push(key)
    this.data.set(key, value)
  }
}

const quotaError = () => new DOMException('Storage is full', 'QuotaExceededError')
const store = useWorkspaceStore
const editNotes = (notes: string) =>
  store.getState().update('Edit notes', (w) => {
    w.notes = notes
  })

function withNotes(notes: string): Workspace {
  return { ...emptyWorkspace('en-US'), notes }
}

/** A stored workspace one version older than current, readable with `oldChain`. */
const OLD = SCHEMA_VERSION - 1
const oldText = JSON.stringify({ ...JSON.parse(serializeWorkspace(withNotes('old'))), schemaVersion: OLD, memo: 'old' })
const oldChain = { [OLD]: ({ memo, ...d }: Record<string, unknown>) => ({ ...d, notes: `${memo} (migrated)` }) }

let storage: FakeStorage
let stop: () => void

function start(migrations?: typeof oldChain) {
  stop = startPersistence(() => storage, store, migrations).stop
}

const stored = () => storage.getItem(STORAGE_KEY)

beforeEach(() => {
  storage = new FakeStorage()
  store.getState().setReadOnly(false)
  store.getState().load(emptyWorkspace('en-US'))
})

afterEach(() => stop())

describe('persistence (§11.1)', () => {
  it('starts empty with nothing stored, then saves each change', () => {
    start()
    expect(store.getState().workspace).toEqual(emptyWorkspace('en-US'))
    expect(storage.writes).toEqual([])
    editNotes('a')
    expect(stored()).toBe(serializeWorkspace(withNotes('a'), 0))
    expect(usePersistence.getState().status).toBe('ok')
  })

  it('loads the stored workspace without an undo step or a write', () => {
    storage.data.set(STORAGE_KEY, serializeWorkspace(withNotes('saved')))
    start()
    expect(store.getState().workspace.notes).toBe('saved')
    expect(store.getState().past).toEqual([])
    expect(storage.writes).toEqual([])
  })

  it('backs up the original before saving a migrated workspace (§11.2)', () => {
    storage.data.set(STORAGE_KEY, oldText)
    start(oldChain)
    expect(store.getState().workspace.notes).toBe('old (migrated)')
    expect(storage.writes).toEqual([BACKUP_KEY, STORAGE_KEY])
    expect(storage.getItem(BACKUP_KEY)).toBe(oldText)
    expect(JSON.parse(stored()!).schemaVersion).toBe(SCHEMA_VERSION)
    expect(usePersistence.getState().hasBackup).toBe(true)
  })

  it('leaves the original alone when the backup fails, until it succeeds', () => {
    storage.data.set(STORAGE_KEY, oldText)
    storage.failWrites = quotaError
    start(oldChain)
    expect(store.getState().workspace.notes).toBe('old (migrated)')
    expect(stored()).toBe(oldText)
    expect(usePersistence.getState()).toMatchObject({ status: 'full', hasBackup: false })

    storage.failWrites = (key) => (key === STORAGE_KEY ? quotaError() : undefined)
    editNotes('b')
    expect(storage.getItem(BACKUP_KEY)).toBe(oldText)
    expect(stored()).toBe(oldText)

    storage.failWrites = null
    editNotes('c')
    expect(stored()).toBe(serializeWorkspace(withNotes('c'), 0))
    expect(usePersistence.getState()).toMatchObject({ status: 'ok', hasBackup: true })
  })

  it.each([
    ['newer', JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, appVersion: '9.0.0' }), 'newerVersion'],
    ['corrupt', '{"schemaVer', 'notJson'],
    ['invalid', JSON.stringify({ schemaVersion: SCHEMA_VERSION, notes: 1 }), 'invalid'],
  ])('never overwrites a %s stored copy', (_, text, kind) => {
    storage.data.set(STORAGE_KEY, text)
    start()
    expect(usePersistence.getState().status).toBe('blocked')
    expect(usePersistence.getState().blockedBy?.kind).toBe(kind)
    expect(store.getState().workspace).toEqual(emptyWorkspace('en-US'))
    editNotes('a')
    expect(stored()).toBe(text)
    expect(storage.writes).toEqual([])
  })

  it('overwrites a blocked copy only when asked', () => {
    storage.data.set(STORAGE_KEY, '{"schemaVer')
    const p = startPersistence(() => storage, store)
    stop = p.stop
    editNotes('a')
    expect(p.readStored()).toBe('{"schemaVer')
    p.overwriteBlocked()
    expect(stored()).toBe(serializeWorkspace(withNotes('a'), 0))
    expect(usePersistence.getState()).toMatchObject({ status: 'ok', blockedBy: null })
  })

  it('works in memory when storage throws', () => {
    stop = startPersistence(() => {
      throw new DOMException('denied', 'SecurityError')
    }, store).stop
    expect(usePersistence.getState().status).toBe('unavailable')
    expect(() => editNotes('a')).not.toThrow()
    expect(store.getState().workspace.notes).toBe('a')
  })

  it('reports full storage, and clears it on the next successful save', () => {
    start()
    storage.failWrites = quotaError
    editNotes('a')
    expect(usePersistence.getState().status).toBe('full')
    storage.failWrites = null
    editNotes('b')
    expect(usePersistence.getState().status).toBe('ok')
    expect(stored()).toBe(serializeWorkspace(withNotes('b'), 0))
  })

  it('reports other write errors as unavailable', () => {
    start()
    storage.failWrites = () => new DOMException('denied', 'SecurityError')
    editNotes('a')
    expect(usePersistence.getState().status).toBe('unavailable')
  })

  it("doesn't save while read-only", () => {
    start()
    store.getState().setReadOnly(true)
    store.getState().load(withNotes('from another tab'))
    expect(storage.writes).toEqual([])
  })

  it('reloads a workspace another tab saved', () => {
    const p = startPersistence(() => storage, store)
    stop = p.stop
    editNotes('a')
    storage.data.set(STORAGE_KEY, serializeWorkspace(withNotes('other tab'), 0))
    p.reload()
    expect(store.getState().workspace.notes).toBe('other tab')
    expect(store.getState().past).toEqual([])
    expect(storage.writes).toEqual([STORAGE_KEY])

    // Unchanged text isn't loaded again, so undo history survives.
    editNotes('b')
    p.reload()
    expect(store.getState().past).toHaveLength(1)
  })

  it('asks for persistent storage once the workspace has content', () => {
    const persist = vi.fn(() => Promise.resolve(true))
    vi.stubGlobal('navigator', { userAgent: 'Chrome', storage: { persist } })
    start()
    editNotes('notes alone')
    expect(persist).not.toHaveBeenCalled()
    store.getState().update('Add terms', (w) => {
      w.terms.push(templateTerms('gainShare'))
    })
    store.getState().update('Add terms', (w) => {
      w.terms.push(templateTerms('lossShare'))
    })
    expect(persist).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('requestPersistentStorage', () => {
  it('skips Firefox, which would prompt', () => {
    const persist = vi.fn(() => Promise.resolve(true))
    requestPersistentStorage({ userAgent: 'Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/130.0', storage: { persist } as never })
    expect(persist).not.toHaveBeenCalled()
  })

  it('ignores failures and missing support', async () => {
    const persist = vi.fn(() => Promise.reject(new Error('no')))
    requestPersistentStorage({ userAgent: 'Safari', storage: { persist } as never })
    expect(persist).toHaveBeenCalled()
    await Promise.resolve()
    expect(() => requestPersistentStorage({ userAgent: 'Safari' } as never)).not.toThrow()
  })
})
