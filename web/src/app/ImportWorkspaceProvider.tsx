import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { MAX_IMPORT_BYTES, type ImportError } from '../format/loadErrors'
import { parseWorkspaceText } from '../io/parse'
import { useWorkspaceStore } from '../state/store'
import { isEmptyWorkspace, type Workspace } from '../state/workspace'
import { useAnnounce } from './announcer'
import { ImportErrorDialog } from './ImportErrorDialog'
import { landingPath } from './landing'
import { ReplaceWorkspaceDialog } from './ReplaceWorkspaceDialog'

/**
 * Importing a workspace file (§11.2). `pick` opens the file picker; render
 * `ui` (the hidden input and the dialogs) next to whatever calls it. A file
 * that can't be opened is explained and changes nothing. A non-empty
 * workspace is replaced only after confirmation, as one undoable step.
 */
export function useImportWorkspace(): { pick(): void; ui: ReactNode } {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<ImportError | null>(null)
  const [pending, setPending] = useState<{ workspace: Workspace; fileName: string } | null>(null)
  const navigate = useNavigate()
  const announce = useAnnounce()
  /** Held until the dialog has closed: while it's open, the live region is hidden from screen readers. */
  const announceAfterClose = useRef<string | null>(null)

  function replace(workspace: Workspace, fileName: string) {
    // Clearing the active tag filter (§8.1.7) goes here once filters exist.
    useWorkspaceStore.getState().update('Import workspace', () => workspace)
    navigate(landingPath(workspace))
    if (pending) {
      announceAfterClose.current = `Imported ${fileName}.`
      setPending(null)
    } else {
      announce(`Imported ${fileName}.`)
    }
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
    if (isEmptyWorkspace(useWorkspaceStore.getState().workspace)) replace(parsed.workspace, file.name)
    else setPending({ workspace: parsed.workspace, fileName: file.name })
  }

  const ui = (
    <>
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
        incoming={pending?.workspace ?? null}
        source={pending?.fileName ?? ''}
        onReplace={() => pending && replace(pending.workspace, pending.fileName)}
        onCancel={() => setPending(null)}
        onExited={() => {
          if (announceAfterClose.current) announce(announceAfterClose.current)
          announceAfterClose.current = null
        }}
      />
    </>
  )

  return {
    pick: () => {
      if (!useWorkspaceStore.getState().readOnly) input.current?.click()
    },
    ui,
  }
}
