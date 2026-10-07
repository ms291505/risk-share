import { SCHEMA_VERSION } from '../state/workspace'

/** A parsed workspace document of some schema version, before validation. */
export type WorkspaceDoc = Record<string, unknown>

/**
 * Upgrades a document from version `n` to `n + 1`, keyed by `n`.
 *
 * To change the workspace format: bump `SCHEMA_VERSION`, add the migration
 * from the old version here, and freeze a fixture of the old format in
 * `__fixtures__`. Never edit a migration once it has been released: files
 * saved by that release depend on it.
 */
export const MIGRATIONS: Record<number, (doc: WorkspaceDoc) => WorkspaceDoc> = {}

/** Runs every migration from `from` up to `SCHEMA_VERSION`. Migrations may throw on malformed input. */
export function migrate(doc: WorkspaceDoc, from: number, migrations = MIGRATIONS, to: number = SCHEMA_VERSION): WorkspaceDoc {
  let out = doc
  for (let v = from; v < to; v++) {
    const step = migrations[v]
    if (!step) throw new Error(`No migration from schema version ${v}`)
    out = { ...step(out), schemaVersion: v + 1 }
  }
  return out
}
