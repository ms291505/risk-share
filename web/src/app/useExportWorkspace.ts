import { useCallback } from 'react'
import { commitActiveField } from '../components/commitActiveField'
import { downloadWorkspace } from '../io/serialize'
import { useWorkspaceStore } from '../state/store'
import { useAnnounce } from './announcer'

/**
 * Exports the workspace to a file (§11.2), including a field being edited,
 * and returns the file name. It announces the export, but a modal hides the
 * live region from screen readers, so dialogs and popovers should also say
 * so in their own content.
 */
export function useExportWorkspace(): () => string {
  const announce = useAnnounce()
  return useCallback(() => {
    commitActiveField()
    const fileName = downloadWorkspace(useWorkspaceStore.getState().workspace)
    announce('Exported the workspace to a file.')
    return fileName
  }, [announce])
}
