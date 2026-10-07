import type { WorkspaceState } from '../state/store'
import { STORAGE_KEY, type Persistence } from './persistence'

const CHANNEL = 'risk-share'

type Message = { type: 'claim'; startedAt: number; tabId: string } | { type: 'released'; to: string }

interface Tab {
  startedAt: number
  tabId: string
}

/** Newer tabs win; the id breaks ties between tabs started in the same millisecond. */
function isNewer(a: Tab, b: Tab): boolean {
  return a.startedAt > b.startedAt || (a.startedAt === b.startedAt && a.tabId > b.tabId)
}

interface Options {
  store: { getState(): Pick<WorkspaceState, 'readOnly' | 'setReadOnly'> }
  persistence: Pick<Persistence, 'reload'>
  channel?: BroadcastChannel
  /** Receives `storage` events from other tabs. */
  events?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  now?: number
  tabId?: string
}

/**
 * One active tab (§11.1): the newest tab is the editor. When a tab opens, it
 * claims the workspace. The editor commits any field being edited (by
 * blurring it, so `CommitTextField` saves its draft), goes read-only and
 * replies, and the new tab then reloads what it saved. Read-only tabs follow
 * later saves through `storage` events. Returns a function that stops it.
 */
export function startTabLock({
  store,
  persistence,
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : undefined,
  events = window,
  now = Date.now(),
  tabId = crypto.randomUUID(),
}: Options): () => void {
  if (!channel) return () => {}
  const me: Tab = { startedAt: now, tabId }

  const claim = () => channel.postMessage({ type: 'claim', ...me } satisfies Message)

  const onMessage = (e: MessageEvent<Message>) => {
    const msg = e.data
    if (msg.type === 'claim' && !store.getState().readOnly) {
      if (isNewer(msg, me)) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        store.getState().setReadOnly(true)
        channel.postMessage({ type: 'released', to: msg.tabId } satisfies Message)
      } else {
        // An older tab claimed late (e.g. after a clock change); remind it who's newer.
        claim()
      }
    } else if (msg.type === 'released' && msg.to === me.tabId) {
      persistence.reload()
    }
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && store.getState().readOnly) persistence.reload()
  }

  channel.addEventListener('message', onMessage)
  events.addEventListener('storage', onStorage)
  claim()
  return () => {
    channel.removeEventListener('message', onMessage)
    events.removeEventListener('storage', onStorage)
    channel.close()
  }
}
