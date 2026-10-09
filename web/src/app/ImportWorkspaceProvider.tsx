import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { MAX_IMPORT_BYTES, type ImportError } from '../format/loadErrors'
import { parseWorkspaceText } from '../io/parse'
import { useWorkspaceStore } from '../state/store'
import { isUntouchedWorkspace, type Workspace } from '../state/workspace'
import { useAnnounce } from './announcer'
import { ImportErrorDialog } from './ImportErrorDialog'
import { ImportWorkspaceContext } from './importWorkspace'
import { landingPath } from './landing'
import { ReplaceWorkspaceDialog } from './ReplaceWorkspaceDialog'

const isReadOnly = () => useWorkspaceStore.getState().readOnly

/**
 * Importing a workspace file (§11.2), for `usePickWorkspaceFile`. Renders the
 * hidden file input and the dialogs once for the whole app. A file that can't
 * be opened is explained and changes nothing. A workspace with anything in it
 * is replaced only after confirmation, as one undoable step.
 */
export function ImportWorkspaceProvider({ children }: { children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<ImportError | null>(null)
  const [pending, setPending] = useState<{ workspace: Workspace; source: string } | null>(null)
  const navigate = useNavigate()
  const announce = useAnnounce()
  /** Held until the dialog has closed: while it's open, the live region is hidden from screen readers. */
  const announceAfterClose = useRef<string | null>(null)

  function replace(workspace: Workspace, fileName: string) {
    setPending(null)
    // Another tab may have become the editor while the file was read or the dialog was open.
    if (isReadOnly()) return setError({ kind: 'readOnly' })
    // Clearing the active tag filter (§8.1.7) goes here once filters exist.
    useWorkspaceStore.getState().update('Import workspace', () => workspace)
    navigate(landingPath(workspace))
    if (pending) announceAfterClose.current = `Imported ${fileName}.`
    else announce(`Imported ${fileName}.`)
  }

  async function open(file: File) {
    if (file.size > MAX_IMPORT_BYTES) return setError({ kind: 'tooLarge' })
    let text: string
    try {
      text = await file.text()
    } catch {
      return setError({ kind: 'unreadable' })
    }
    const parsed = parseWorkspaceText(text)
    if (!parsed.ok) return setError(parsed.error)
    if (isReadOnly()) return setError({ kind: 'readOnly' })
    if (isUntouchedWorkspace(useWorkspaceStore.getState().workspace)) replace(parsed.workspace, file.name)
    else setPending({ workspace: parsed.workspace, source: file.name })
  }

  const pick = useCallback(() => {
    if (!isReadOnly()) input.current?.click()
  }, [])

  return (
    <ImportWorkspaceContext value={pick}>
      {children}
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // so picking the same file again still fires
          if (file) void open(file)
        }}
      />
      <ImportErrorDialog error={error} onClose={() => setError(null)} />
      <ReplaceWorkspaceDialog
        incoming={pending}
        onReplace={() => pending && replace(pending.workspace, pending.source)}
        onCancel={() => setPending(null)}
        onExited={() => {
          if (announceAfterClose.current) announce(announceAfterClose.current)
          announceAfterClose.current = null
        }}
      />
    </ImportWorkspaceContext>
  )
}
