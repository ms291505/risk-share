import { createContext, useContext } from 'react'

export const ImportWorkspaceContext = createContext<() => void>(() => {})

/** Opens the file picker to import a workspace (§11.2). Does nothing while read-only. */
export function usePickWorkspaceFile(): () => void {
  return useContext(ImportWorkspaceContext)
}
