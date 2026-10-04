import type { AmountSet, Parties, SweepSpec, Terms } from '../calc'

export const SCHEMA_VERSION = 1

export interface WorkspaceSettings {
  /** ISO 4217 code; one currency per workspace (§2.2). */
  currency: string
  /** BCP 47 tag used for number entry and formatting (§2.4). */
  locale: string
}

/** Tag names are case-insensitive and keep the spelling first entered (§8.2). */
export interface Tag {
  id: string
  name: string
}

/** One set of terms paired with one amount set (§8). */
export interface Scenario {
  id: string
  name: string
  termsId: string
  amountSetId: string
  tagIds: string[]
  /** Manual per-scenario hide; always wins over the filter (§8.1.3). */
  hidden: boolean
  /** Markdown. */
  notes: string
  /**
   * ISO 8601 timestamp, from `nextCreatedAt`. Decides the "earliest-created
   * scenario" (§10.1), so reordering scenarios never changes it (§8.7).
   */
  createdAt: string
}

/** A saved sensitivity sweep (§9). */
export interface SavedSweep {
  id: string
  name: string
  baselineAmountSetId: string
  /** One series per terms set. */
  termsIds: string[]
  spec: SweepSpec
}

/** A named tag filter (§8.1). Tags are referenced by id so renames carry through. */
export interface FilterView {
  id: string
  name: string
  showTagIds: string[]
  showMatch: 'any' | 'all'
  hideTagIds: string[]
}

/** Everything the workspace JSON export contains (§2.1, §11.2). Arrays are in display order. */
export interface Workspace {
  /** Loaded files are migrated to exactly this version (§11.2). */
  schemaVersion: typeof SCHEMA_VERSION
  settings: WorkspaceSettings
  parties: Parties
  terms: Terms[]
  amountSets: AmountSet[]
  scenarios: Scenario[]
  tags: Tag[]
  sweeps: SavedSweep[]
  filterViews: FilterView[]
  /** Markdown. */
  notes: string
}

/** A new workspace: always USD, in the browser's locale, with role names as party names (§2.7). */
export function emptyWorkspace(locale: string = navigator.language): Workspace {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { currency: 'USD', locale },
    parties: { riskBearer: 'Risk-bearer', counterparty: 'Counterparty' },
    terms: [],
    amountSets: [],
    scenarios: [],
    tags: [],
    sweeps: [],
    filterViews: [],
    notes: '',
  }
}

/** True until the user adds terms, amount sets or scenarios. */
export function isEmptyWorkspace(w: Workspace): boolean {
  return w.terms.length === 0 && w.amountSets.length === 0 && w.scenarios.length === 0
}

/**
 * The creation time for a new scenario: now, but always later than every
 * existing scenario, so scenarios created together (Generate grid, "Show me",
 * duplicate) keep their creation order (§8.7). When creating several, add each
 * one before asking for the next.
 */
export function nextCreatedAt(scenarios: Pick<Scenario, 'createdAt'>[], now: Date = new Date()): string {
  const latest = Math.max(-Infinity, ...scenarios.map((s) => Date.parse(s.createdAt)))
  return new Date(Math.max(now.getTime(), latest + 1)).toISOString()
}

/** Creation order (§8.7): by `createdAt`, then by `id` for ties, which only imported files can have. */
export function compareCreated(a: Pick<Scenario, 'createdAt' | 'id'>, b: Pick<Scenario, 'createdAt' | 'id'>): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}
