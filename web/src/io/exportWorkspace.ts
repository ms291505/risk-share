import type { Workspace } from '../state/workspace'

export function workspaceFileName(date: Date = new Date()): string {
  return `risk-share-${date.toISOString().slice(0, 10)}.json`
}

/** Downloads the whole workspace as JSON (§11.2). Import and validation come later. */
export function downloadWorkspace(workspace: Workspace): void {
  const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = workspaceFileName()
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
