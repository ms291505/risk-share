// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from './persistence'
import { startTabLock } from './tabLock'

/** A tab: its own read-only flag, a reload spy, its stored text and an event target. */
function tab(startedAt: number, tabId: string, stored: string | null = null) {
  const state = { readOnly: false, setReadOnly: (r: boolean) => void (state.readOnly = r) }
  const reload = vi.fn()
  const events = new EventTarget()
  const stop = startTabLock({
    store: { getState: () => state },
    persistence: { reload, readStored: () => stored },
    channel: new BroadcastChannel('tab-lock-test'),
    events: events as unknown as Window,
    now: startedAt,
    tabId,
  })
  stops.push(stop)
  const dispatch = (type: string, init?: object) => events.dispatchEvent(Object.assign(new Event(type), init))
  return { state, reload, dispatch }
}

/** A focused input that records whether its tab was already read-only when it lost focus. */
function focusedInput(isReadOnly: () => boolean) {
  const blurs: string[] = []
  const input = document.body.appendChild(document.createElement('input'))
  input.addEventListener('blur', () => blurs.push(isReadOnly() ? 'blur after read-only' : 'blur'))
  input.focus()
  return { blurs, remove: () => input.remove() }
}

const stops: (() => void)[] = []
/** BroadcastChannel delivery is asynchronous and can be slow on a loaded machine. */
const WAIT = { timeout: 5000 }
afterEach(() => stops.splice(0).forEach((stop) => stop()))

describe('one active tab (§11.1)', () => {
  it('makes the older tab read-only, and the new tab loads what it saved', async () => {
    const old = tab(1000, 'a', 'saved by a')
    const input = focusedInput(() => old.state.readOnly)

    const fresh = tab(2000, 'b')
    await vi.waitFor(() => expect(fresh.reload).toHaveBeenCalledOnce(), WAIT)
    expect(fresh.reload).toHaveBeenCalledWith('saved by a')
    expect(old.state.readOnly).toBe(true)
    expect(input.blurs).toEqual(['blur'])
    expect(fresh.state.readOnly).toBe(false)
    expect(old.reload).not.toHaveBeenCalled()
    input.remove()
  })

  it('keeps the newest tab as the editor when an older one starts late', async () => {
    const newer = tab(2000, 'a')
    const older = tab(1000, 'b')
    await vi.waitFor(() => expect(older.state.readOnly).toBe(true), WAIT)
    expect(newer.state.readOnly).toBe(false)
    expect(older.reload).toHaveBeenCalledWith()
    expect(newer.reload).not.toHaveBeenCalled()
  })

  it('breaks ties by tab id', async () => {
    const a = tab(1000, 'a')
    const b = tab(1000, 'b')
    await vi.waitFor(() => expect(a.state.readOnly).toBe(true), WAIT)
    expect(b.state.readOnly).toBe(false)
  })

  it.each(['pageshow', 'visibilitychange'])('claims again on %s, and a stale tab gives up its draft', async (type) => {
    const newer = tab(2000, 'a')
    const stale = tab(1000, 'b')
    await vi.waitFor(() => expect(stale.state.readOnly).toBe(true), WAIT)
    // As if it had been frozen or cached while the newer tab claimed.
    stale.state.readOnly = false
    stale.reload.mockClear()
    const input = focusedInput(() => stale.state.readOnly)

    stale.dispatch(type)
    await vi.waitFor(() => expect(stale.state.readOnly).toBe(true), WAIT)
    expect(input.blurs).toEqual(['blur after read-only'])
    expect(stale.reload).toHaveBeenCalledOnce()
    expect(newer.state.readOnly).toBe(false)
    input.remove()
  })

  it('reloads read-only tabs when the editor saves', async () => {
    const old = tab(1000, 'a')
    const fresh = tab(2000, 'b')
    await vi.waitFor(() => expect(fresh.reload).toHaveBeenCalledOnce(), WAIT)
    old.dispatch('storage', { key: STORAGE_KEY })
    old.dispatch('storage', { key: 'risk-share-mode' })
    fresh.dispatch('storage', { key: STORAGE_KEY })
    expect(old.reload).toHaveBeenCalledOnce()
    expect(fresh.reload).toHaveBeenCalledOnce() // only the reply to its claim
  })
})
