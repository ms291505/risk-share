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

/** Everything the workspace JSON export contains (§2.1, §11.2). Arrays are in creation order. */
export interface Workspace {
  schemaVersion: number
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
