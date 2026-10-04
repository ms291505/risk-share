import { beforeEach, describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, selectCanRedo, selectCanUndo, useWorkspaceStore } from './store'

const store = useWorkspaceStore
const notes = () => store.getState().workspace.notes

describe('workspace store undo/redo (§12)', () => {
  beforeEach(() => store.setState(store.getInitialState(), true))

  it('round-trips update, undo and redo', () => {
    store.getState().update('Edit notes', (w) => {
      w.notes = 'first'
    })
    store.getState().update('Edit notes', (w) => {
      w.notes = 'second'
    })
    expect(notes()).toBe('second')

    expect(store.getState().undo()).toBe('Edit notes')
    expect(notes()).toBe('first')
    expect(selectCanRedo(store.getState())).toBe(true)

    store.getState().redo()
    expect(notes()).toBe('second')
    expect(selectCanRedo(store.getState())).toBe(false)
  })

  it('clears redo history on a new change', () => {
    store.getState().update('Edit notes', (w) => {
      w.notes = 'a'
    })
    store.getState().undo()
    store.getState().update('Edit notes', (w) => {
      w.notes = 'b'
    })
    expect(selectCanRedo(store.getState())).toBe(false)
    expect(store.getState().redo()).toBeNull()
  })

  it('ignores changes that change nothing', () => {
    store.getState().update('No-op', () => {})
    expect(selectCanUndo(store.getState())).toBe(false)
  })

  it(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) {
      store.getState().update('Edit notes', (w) => {
        w.notes = String(i)
      })
    }
    expect(store.getState().past).toHaveLength(HISTORY_LIMIT)
    while (store.getState().undo() !== null);
    expect(notes()).toBe('5')
  })
})
