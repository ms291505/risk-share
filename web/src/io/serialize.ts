import type { Workspace } from '../state/workspace'

/**
 * The workspace file format (§11.2), used for exported files and the
 * browser-stored copy alike: the workspace plus the `appVersion` that wrote
 * it. `appVersion` is only informational (it names the app a too-new file
 * needs); `schemaVersion` decides migration.
 */
export function serializeWorkspace(workspace: Workspace, indent = 2): string {
  const { schemaVersion, ...rest } = workspace
  return JSON.stringify({ schemaVersion, appVersion: __APP_VERSION__, ...rest }, null, indent)
}

export function workspaceFileName(date: Date = new Date()): string {
  return `risk-share-${date.toISOString().slice(0, 10)}.json`
}

/** Downloads the whole workspace as a JSON file (§11.2). */
export function downloadWorkspace(workspace: Workspace): void {
  downloadText(serializeWorkspace(workspace), workspaceFileName())
}

/** Downloads text as a JSON file, e.g. a stored workspace the app can't open. */
export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
