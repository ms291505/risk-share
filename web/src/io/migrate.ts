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

// Migrations are frozen, so they use only the helpers below, never app code that may change.

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const DECIMAL = /^-?\d+(\.\d+)?$/
const decimalsOf = (s: string) => s.split('.')[1]?.length ?? 0
const isZero = (s: string) => /^-?0+(\.0+)?$/.test(s)

/** Exact a − b for decimal strings, keeping the longer scale. */
function subtract(a: string, b: string): string {
  const scale = Math.max(decimalsOf(a), decimalsOf(b))
  const scaled = (s: string) => BigInt(s.replace('.', '') + '0'.repeat(scale - decimalsOf(s)))
  const n = scaled(a) - scaled(b)
  const digits = (n < 0n ? -n : n).toString().padStart(scale + 1, '0')
  const abs = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits
  return n < 0n ? `-${abs}` : abs
}

/**
 * v1 → v2: additions entered as a total could carry a counterparty-paid
 * amount; from v2 only marked components record it (§4.6). Such a total
 * becomes components, "Paid by ‹counterparty›" (marked) and "Other
 * additions" (the rest), so results don't change. The rest is exact even
 * when an amount has too many decimals, so both rows show the error and the
 * sum stays right. Where either amount isn't a number, the rest is left
 * blank, keeping the set invalid rather than letting the total change once
 * the paid amount is fixed; the old total is kept in the row's name.
 * Components kept inactive beside the total are replaced, as splitting a
 * total does (§4.3).
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
  if (additions.mode !== 'total' || paid === '' || isZero(paid)) return { ...set, additions }

  const total = additions.total
  const paidRow = { id: crypto.randomUUID(), name: `Paid by ${counterparty}`, amount: paid, paidByCounterparty: true }
  const components: Record<string, unknown>[] = [paidRow]
  if (typeof total === 'string' && DECIMAL.test(total) && DECIMAL.test(paid)) {
    const rest = subtract(total, paid)
    if (!isZero(rest)) components.push({ id: crypto.randomUUID(), name: 'Other additions', amount: rest })
  } else {
    const name =
      typeof total === 'string' && total.trim() ? `Other additions (total was ${total.trim()})` : 'Other additions'
    components.push({ id: crypto.randomUUID(), name, amount: '' })
  }
  return { ...set, additions: { ...additions, mode: 'components', components } }
}
