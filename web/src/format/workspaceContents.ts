import type { Workspace } from '../state/workspace'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** E.g. "3 sets of terms, 2 amount sets and 6 scenarios", or "an empty workspace". */
export function describeContents(w: Workspace): string {
  const parts = [
    w.terms.length > 0 && count(w.terms.length, 'set of terms', 'sets of terms'),
    w.amountSets.length > 0 && count(w.amountSets.length, 'amount set', 'amount sets'),
    w.scenarios.length > 0 && count(w.scenarios.length, 'scenario', 'scenarios'),
  ].filter((p) => p !== false)
  if (parts.length === 0) return 'an empty workspace'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}
