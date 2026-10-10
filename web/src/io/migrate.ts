import { isDecimalString, parseDecimal, subtractDecimals } from '../calc'
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
export const MIGRATIONS: Record<number, (doc: WorkspaceDoc) => WorkspaceDoc> = {
  1: v1ToV2,
}

/** Runs every migration from `from` up to `SCHEMA_VERSION`. Migrations may throw on malformed input. */
export function migrate(
  doc: WorkspaceDoc,
  from: number,
  migrations = MIGRATIONS,
  to: number = SCHEMA_VERSION,
): WorkspaceDoc {
  let out = doc
  for (let v = from; v < to; v++) {
    const step = migrations[v]
    if (!step) throw new Error(`No migration from schema version ${v}`)
    out = { ...step(out), schemaVersion: v + 1 }
  }
  return out
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * v1 → v2: additions entered as a total could carry a counterparty-paid
 * amount; from v2 only marked components record it (§4.6). Such a total
 * becomes components, "Paid by ‹counterparty›" (marked) and "Other
 * additions" (the rest), so results don't change. Text that isn't a number
 * stays in its component, where it shows as an error. Components kept
 * inactive beside the total are replaced, as splitting a total does (§4.3).
 */
function v1ToV2(doc: WorkspaceDoc): WorkspaceDoc {
  if (!Array.isArray(doc.amountSets)) return doc
  const name = isObj(doc.parties) && typeof doc.parties.counterparty === 'string' ? doc.parties.counterparty.trim() : ''
  const counterparty = name || 'Counterparty'
  return { ...doc, amountSets: doc.amountSets.map((set) => v1AmountSet(set, counterparty)) }
}

function v1AmountSet(set: unknown, counterparty: string): unknown {
  if (!isObj(set) || !isObj(set.additions)) return set
  const { paidByCounterparty, ...additions } = set.additions
  const paid = typeof paidByCounterparty === 'string' ? paidByCounterparty.trim() : ''
  if (additions.mode !== 'total' || paid === '' || parseDecimal(paid)?.eq(0)) return { ...set, additions }

  const total = additions.total
  const rest = isDecimalString(total) && isDecimalString(paid) ? subtractDecimals(total, paid) : total
  const components: Record<string, unknown>[] = [
    { id: crypto.randomUUID(), name: `Paid by ${counterparty}`, amount: paid, paidByCounterparty: true },
  ]
  const restIsZero = typeof rest === 'string' && parseDecimal(rest)?.eq(0)
  if (!restIsZero) {
    components.push({ id: crypto.randomUUID(), name: 'Other additions', amount: rest })
  }
  return { ...set, additions: { ...additions, mode: 'components', components } }
}
