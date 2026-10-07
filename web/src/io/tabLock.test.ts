// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from './persistence'
import { startTabLock } from './tabLock'

/** A tab: its own read-only flag, a reload spy and a storage-event target. */
function tab(startedAt: number, tabId: string) {
  const state = { readOnly: false, setReadOnly: (r: boolean) => void (state.readOnly = r) }
  const reload = vi.fn()
  const events = new EventTarget()
  const stop = startTabLock({
    store: { getState: () => state },
    persistence: { reload },
    channel: new BroadcastChannel('tab-lock-test'),
    events: events as unknown as Window,
    now: startedAt,
    tabId,
  })
  stops.push(stop)
  const storageEvent = (key: string) => events.dispatchEvent(Object.assign(new Event('storage'), { key }))
  return { state, reload, storageEvent }
}

const stops: (() => void)[] = []
afterEach(() => stops.splice(0).forEach((stop) => stop()))

describe('one active tab (§11.1)', () => {
  it('makes the older tab read-only, and the new tab reloads what it saved', async () => {
    const old = tab(1000, 'a')
    const order: string[] = []
    const input = document.body.appendChild(document.createElement('input'))
    input.addEventListener('blur', () => order.push(old.state.readOnly ? 'blur after read-only' : 'blur'))
    input.focus()

    const fresh = tab(2000, 'b')
    await vi.waitFor(() => expect(fresh.reload).toHaveBeenCalledOnce())
    expect(old.state.readOnly).toBe(true)
    expect(order).toEqual(['blur'])
    expect(fresh.state.readOnly).toBe(false)
    expect(old.reload).not.toHaveBeenCalled()
    input.remove()
  })

  it('keeps the newest tab as the editor when an older one starts late', async () => {
    const newer = tab(2000, 'a')
    const older = tab(1000, 'b')
    await vi.waitFor(() => expect(older.state.readOnly).toBe(true))
    expect(newer.state.readOnly).toBe(false)
  })

  it('breaks ties by tab id', async () => {
    const a = tab(1000, 'a')
    const b = tab(1000, 'b')
    await vi.waitFor(() => expect(a.state.readOnly).toBe(true))
    expect(b.state.readOnly).toBe(false)
  })

  it('reloads read-only tabs when the editor saves', async () => {
    const old = tab(1000, 'a')
    const fresh = tab(2000, 'b')
    await vi.waitFor(() => expect(old.state.readOnly).toBe(true))
    old.storageEvent(STORAGE_KEY)
    old.storageEvent('risk-share-mode')
    fresh.storageEvent(STORAGE_KEY)
    expect(old.reload).toHaveBeenCalledOnce()
    expect(fresh.reload).toHaveBeenCalledOnce() // only the reply to its claim
  })
})
