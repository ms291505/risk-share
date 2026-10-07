import { SCHEMA_VERSION, type Workspace } from '../state/workspace'
import { MIGRATIONS, migrate, type WorkspaceDoc } from './migrate'
import { validateWorkspace, type LoadProblem } from './validate'

export type LoadError =
  | { kind: 'notJson' }
  /** JSON, but not an object with a `schemaVersion` this app knows. */
  | { kind: 'notAWorkspace' }
  /** Saved by a newer app; `appVersion` names it when the file says. */
  | { kind: 'newerVersion'; schemaVersion: number; appVersion?: string }
  | { kind: 'migrationFailed'; schemaVersion: number }
  | { kind: 'invalid'; problems: LoadProblem[] }

export type ParseResult =
  | {
      ok: true
      workspace: Workspace
      /** The app version that wrote the file, if it says. */
      appVersion?: string
      /** Set when the file was in an older format and has been migrated. */
      migratedFrom?: number
    }
  | { ok: false; error: LoadError }

/**
 * Reads a workspace file or the browser-stored copy (§11.2): parses the
 * JSON, migrates older versions, then validates. Never throws.
 */
export function parseWorkspaceText(text: string, migrations = MIGRATIONS): ParseResult {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return { ok: false, error: { kind: 'notJson' } }
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return { ok: false, error: { kind: 'notAWorkspace' } }
  const { schemaVersion: version, appVersion: rawAppVersion, ...rest } = doc as WorkspaceDoc
  const appVersion = typeof rawAppVersion === 'string' ? rawAppVersion : undefined
  if (typeof version !== 'number' || !Number.isSafeInteger(version)) return { ok: false, error: { kind: 'notAWorkspace' } }
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: { kind: 'newerVersion', schemaVersion: version, ...(appVersion && { appVersion }) } }
  }
  // Known versions are the current one and those with a migration (so, never below 1).
  if (version < SCHEMA_VERSION && !Object.hasOwn(migrations, version)) {
    return { ok: false, error: { kind: 'notAWorkspace' } }
  }

  let migrated: WorkspaceDoc
  try {
    migrated = migrate(rest, version, migrations)
  } catch {
    return { ok: false, error: { kind: 'migrationFailed', schemaVersion: version } }
  }
  const result = validateWorkspace(migrated)
  if (!result.ok) return { ok: false, error: { kind: 'invalid', problems: result.problems } }
  return {
    ok: true,
    workspace: result.workspace,
    ...(appVersion && { appVersion }),
    ...(version < SCHEMA_VERSION && { migratedFrom: version }),
  }
}
