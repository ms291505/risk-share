import type { WorkspaceState } from '../state/store'
import { STORAGE_KEY, type Persistence } from './persistence'

const CHANNEL = 'risk-share'

type Message =
  | { type: 'claim'; startedAt: number; tabId: string }
  /** The reply to a newer tab's claim, with what the replying tab saved. */
  | { type: 'released'; to: string; text: string | null }
  /** The reply to an older tab's claim. */
  | { type: 'editing'; startedAt: number; tabId: string }

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
  persistence: Pick<Persistence, 'reload' | 'readStored'>
  channel?: BroadcastChannel
  /** Receives `storage`, `pageshow` and `visibilitychange` events. */
  events?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  now?: number
  tabId?: string
}

/**
 * One active tab (§11.1): the newest tab is the editor. When a tab opens, it
 * claims the workspace. The editor commits any field being edited (by
 * blurring it, so `CommitTextField` saves its draft), goes read-only and
 * replies with what it saved, which the new tab loads. Read-only tabs follow
 * later saves through `storage` events.
 *
 * A tab that was frozen or in the back/forward cache may have missed a claim,
 * so an editor claims again whenever it's shown. If a newer editor answers,
 * this tab's view is stale: it goes read-only without committing the field
 * being edited, so it can't overwrite the newer tab's work. Returns a
 * function that stops it.
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

  const post = (msg: Message) => channel.postMessage(msg)
  const isEditor = () => !store.getState().readOnly
  const claim = () => {
    if (isEditor()) post({ type: 'claim', ...me })
  }

  const onMessage = (e: MessageEvent<Message>) => {
    const msg = e.data
    if (msg.type === 'claim' && isEditor()) {
      if (isNewer(msg, me)) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        store.getState().setReadOnly(true)
        post({ type: 'released', to: msg.tabId, text: persistence.readStored() })
      } else {
        post({ type: 'editing', ...me })
      }
    } else if (msg.type === 'editing' && isEditor() && isNewer(msg, me)) {
      // Read-only first, so blurring discards the stale draft instead of saving it.
      store.getState().setReadOnly(true)
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      persistence.reload()
    } else if (msg.type === 'released' && msg.to === me.tabId) {
      persistence.reload(msg.text)
    }
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && !isEditor()) persistence.reload()
  }

  channel.addEventListener('message', onMessage)
  events.addEventListener('storage', onStorage)
  events.addEventListener('pageshow', claim)
  events.addEventListener('visibilitychange', claim)
  claim()
  return () => {
    channel.removeEventListener('message', onMessage)
    events.removeEventListener('storage', onStorage)
    events.removeEventListener('pageshow', claim)
    events.removeEventListener('visibilitychange', claim)
    channel.close()
  }
}
