import type {
  AdditionsGroup,
  AmountComponent,
  AmountGroup,
  AmountSet,
  CurrencyRange,
  Side,
  SideLimits,
  SweepSpec,
  SweepVariable,
  Terms,
  Tier,
} from '../calc'
import { minorUnits } from '../calc'
import { sameName } from '../state/names'
import {
  SCHEMA_VERSION,
  type FilterView,
  type SavedSweep,
  type Scenario,
  type Tag,
  type Workspace,
} from '../state/workspace'

/** The top-level object a problem is in. `index` is 0-based; `name` is included when it's readable. */
export type Place =
  | { kind: 'workspace' }
  | { kind: 'terms' | 'amountSet' | 'scenario' | 'tag' | 'sweep' | 'filterView'; index: number; name?: string }

export type Expected = 'text' | 'number' | 'boolean' | 'list' | 'object'

export type LoadProblem = { place: Place; field: (string | number)[] } & (
  | { code: 'missing' }
  | { code: 'wrongType'; expected: Expected }
  | { code: 'unknownValue'; value: string; allowed: readonly string[] }
  | { code: 'emptyId' }
  | { code: 'duplicateId'; id: string }
  | { code: 'duplicateTagName'; name: string }
  | { code: 'duplicateTagRef'; id: string }
  | { code: 'badPrecision' }
  | { code: 'badCurrency'; value: string }
  | { code: 'badLocale'; value: string }
  | { code: 'badTimestamp'; value: string }
  | { code: 'missingRef'; target: 'terms' | 'amountSet' | 'tag'; id: string }
)

/** A problem minus its location, which the checker adds. */
type What = LoadProblem extends infer P ? (P extends unknown ? Omit<P, 'place' | 'field'> : never) : never

export type ValidateResult = { ok: true; workspace: Workspace } | { ok: false; problems: LoadProblem[] }

type Obj = Record<string, unknown>
type Path = (string | number)[]

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * ISO 8601 date and time with an explicit offset, e.g. what `toISOString`
 * writes. Without an offset the time would depend on the reader's time zone.
 */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

/**
 * Strictly checks a document already migrated to `SCHEMA_VERSION` (§11.2)
 * and builds a fresh `Workspace` from the known fields only, so unknown
 * fields (including `__proto__`) never get in.
 *
 * It checks structure, not business rules: values that are invalid in the
 * §4.7/§6.4 sense (any text in a decimal field, empty names, unordered
 * thresholds) load and show inline errors, as they do when typed. Sweeps may
 * point to deleted objects (§9.7). Anything else that would break the app,
 * such as duplicate ids, a scenario whose terms are missing, or an unreadable
 * timestamp, is rejected.
 */
export function validateWorkspace(doc: Obj): ValidateResult {
  const c = new Checker()
  const ws = c.workspace(doc)
  return c.problems.length === 0 ? { ok: true, workspace: ws } : { ok: false, problems: c.problems }
}

class Checker {
  problems: LoadProblem[] = []
  private place: Place = { kind: 'workspace' }

  private report(field: Path, what: What) {
    this.problems.push({ place: this.place, field, ...what } as LoadProblem)
  }

  // --- Primitives. Each returns a fallback after reporting, so one pass finds every problem.

  private get(o: Obj, key: string): unknown {
    return Object.hasOwn(o, key) ? o[key] : undefined
  }

  private typed<T>(o: Obj, key: string, path: Path, expected: Expected, test: (v: unknown) => v is T, fallback: T): T {
    const v = this.get(o, key)
    if (v === undefined) this.report([...path, key], { code: 'missing' })
    else if (!test(v)) this.report([...path, key], { code: 'wrongType', expected })
    else return v
    return fallback
  }

  private str(o: Obj, key: string, path: Path): string {
    return this.typed(o, key, path, 'text', (v) => typeof v === 'string', '')
  }

  private optStr(o: Obj, key: string, path: Path): string | undefined {
    return this.get(o, key) === undefined ? undefined : this.str(o, key, path)
  }

  private bool(o: Obj, key: string, path: Path): boolean {
    return this.typed(o, key, path, 'boolean', (v) => typeof v === 'boolean', false)
  }

  private obj(o: Obj, key: string, path: Path): Obj {
    return this.typed(o, key, path, 'object', isObj, {})
  }

  private list(o: Obj, key: string, path: Path): unknown[] {
    return this.typed(o, key, path, 'list', Array.isArray, [])
  }

  private oneOf<T extends string>(o: Obj, key: string, path: Path, allowed: readonly T[]): T {
    const v = this.str(o, key, path)
    if (typeof this.get(o, key) === 'string' && !allowed.includes(v as T)) {
      this.report([...path, key], { code: 'unknownValue', value: v, allowed })
    }
    return v as T
  }

  /** Items of a list that must be objects; reports the others. */
  private objects(items: unknown[], path: Path): [Obj, number][] {
    const out: [Obj, number][] = []
    items.forEach((item, i) => {
      if (isObj(item)) out.push([item, i])
      else this.report([...path, i], { code: 'wrongType', expected: 'object' })
    })
    return out
  }

  private strings(o: Obj, key: string, path: Path): string[] {
    const items = this.list(o, key, path)
    items.forEach((v, i) => {
      if (typeof v !== 'string') this.report([...path, key, i], { code: 'wrongType', expected: 'text' })
    })
    return items.filter((v): v is string => typeof v === 'string')
  }

  private id(o: Obj, path: Path): string {
    const id = this.str(o, 'id', path)
    if (this.get(o, 'id') === '') this.report([...path, 'id'], { code: 'emptyId' })
    return id
  }

  /** Reports ids that appear more than once in one list. */
  private uniqueIds(items: { id: string }[], path: (i: number) => Path, place?: (i: number) => Place) {
    const seen = new Set<string>()
    items.forEach((item, i) => {
      if (item.id === '') return
      if (seen.has(item.id)) {
        if (place) this.place = place(i)
        this.report(path(i), { code: 'duplicateId', id: item.id })
      }
      seen.add(item.id)
    })
  }

  /** Checks each top-level object of a collection, with `place` set so problems name it. */
  private collection<T extends { id: string }>(
    doc: Obj,
    key: string,
    kind: Exclude<Place['kind'], 'workspace'>,
    check: (o: Obj) => T,
  ): T[] {
    this.place = { kind: 'workspace' }
    const out: T[] = []
    const places: Place[] = []
    for (const [o, index] of this.objects(this.list(doc, key, []), [key])) {
      const name = this.get(o, 'name')
      this.place = { kind, index, ...(typeof name === 'string' && name.trim() !== '' && { name }) }
      places.push(this.place)
      out.push(check(o))
    }
    this.uniqueIds(out, () => ['id'], (i) => places[i])
    this.place = { kind: 'workspace' }
    return out
  }

  // --- The workspace.

  workspace(doc: Obj): Workspace {
    const settingsObj = this.obj(doc, 'settings', [])
    const partiesObj = this.obj(doc, 'parties', [])
    const settings = { currency: this.currency(settingsObj), locale: this.locale(settingsObj) }
    const parties = {
      riskBearer: this.str(partiesObj, 'riskBearer', ['parties']),
      counterparty: this.str(partiesObj, 'counterparty', ['parties']),
    }
    const notes = this.str(doc, 'notes', [])

    const terms = this.collection(doc, 'terms', 'terms', (o) => this.terms(o))
    const amountSets = this.collection(doc, 'amountSets', 'amountSet', (o) => this.amountSet(o))
    const tags = this.collection(doc, 'tags', 'tag', (o) => this.tag(o))
    this.uniqueTagNames(tags)
    const known = { terms: ids(terms), amountSet: ids(amountSets), tag: ids(tags) }
    const scenarios = this.collection(doc, 'scenarios', 'scenario', (o) => this.scenario(o, known))
    const sweeps = this.collection(doc, 'sweeps', 'sweep', (o) => this.sweep(o))
    const filterViews = this.collection(doc, 'filterViews', 'filterView', (o) => this.filterView(o, known.tag))

    return {
      schemaVersion: SCHEMA_VERSION,
      settings,
      parties,
      terms,
      amountSets,
      scenarios,
      tags,
      sweeps,
      filterViews,
      notes,
    }
  }

  private currency(o: Obj): string {
    const path = ['settings']
    const v = this.str(o, 'currency', path)
    if (typeof this.get(o, 'currency') !== 'string') return v
    let ok = /^[A-Z]{3}$/.test(v)
    try {
      if (ok) minorUnits(v)
    } catch {
      ok = false
    }
    if (!ok) this.report([...path, 'currency'], { code: 'badCurrency', value: v })
    return v
  }

  private locale(o: Obj): string {
    const path = ['settings']
    const v = this.str(o, 'locale', path)
    if (typeof this.get(o, 'locale') !== 'string') return v
    try {
      if (Intl.getCanonicalLocales(v).length !== 1) throw new RangeError()
    } catch {
      this.report([...path, 'locale'], { code: 'badLocale', value: v })
    }
    return v
  }

  // --- Terms (§6).

  private terms(o: Obj): Terms {
    const t: Terms = {
      id: this.id(o, []),
      name: this.str(o, 'name', []),
      unit: this.oneOf(o, 'unit', [], ['costRatio', 'currency'] as const),
      type: this.oneOf(o, 'type', [], ['gain', 'loss', 'full'] as const),
      crPrecision: this.precision(o),
      roundingMode: this.oneOf(o, 'roundingMode', [], ['halfUp', 'halfEven', 'truncate'] as const),
    }
    for (const key of ['gain', 'loss'] as const) {
      if (this.get(o, key) !== undefined) t[key] = this.side(this.obj(o, key, []), [key])
    }
    return t
  }

  /** Any non-negative whole number. Out-of-range values load and show the §6.4 error. */
  private precision(o: Obj): number {
    const v = this.typed(o, 'crPrecision', [], 'number', (v) => typeof v === 'number', 1)
    if (typeof this.get(o, 'crPrecision') === 'number' && !(Number.isSafeInteger(v) && v >= 0)) {
      this.report(['crPrecision'], { code: 'badPrecision' })
    }
    return v
  }

  private side(o: Obj, path: Path): Side {
    const tiers = this.objects(this.list(o, 'tiers', path), [...path, 'tiers']).map(
      ([t, i]): Tier => ({
        id: this.id(t, [...path, 'tiers', i]),
        name: this.str(t, 'name', [...path, 'tiers', i]),
        threshold: this.str(t, 'threshold', [...path, 'tiers', i]),
        sharePct: this.str(t, 'sharePct', [...path, 'tiers', i]),
      }),
    )
    this.uniqueIds(tiers, (i) => [...path, 'tiers', i, 'id'])
    return { tiers, limits: this.limits(this.obj(o, 'limits', path), [...path, 'limits']) }
  }

  private limits(o: Obj, path: Path): SideLimits {
    const out: SideLimits = {}
    const maxPayout = this.optStr(o, 'maxPayout', path)
    if (maxPayout !== undefined) out.maxPayout = maxPayout
    const pct = this.optStr(o, 'maxPayoutPctOfAdditions', path)
    if (pct !== undefined) out.maxPayoutPctOfAdditions = pct
    if (this.get(o, 'minimum') !== undefined) {
      const m = this.obj(o, 'minimum', path)
      out.minimum = {
        amount: this.str(m, 'amount', [...path, 'minimum']),
        behavior: this.oneOf(m, 'behavior', [...path, 'minimum'], ['allOrNothing', 'deductible'] as const),
      }
    }
    return out
  }

  // --- Amount sets (§4).

  private amountSet(o: Obj): AmountSet {
    const additions = this.obj(o, 'additions', [])
    const group = this.group(additions, ['additions']) as AdditionsGroup
    const paid = this.optStr(additions, 'paidByCounterparty', ['additions'])
    if (paid !== undefined) group.paidByCounterparty = paid
    return {
      id: this.id(o, []),
      name: this.str(o, 'name', []),
      additions: group,
      deductions: this.group(this.obj(o, 'deductions', []), ['deductions']),
    }
  }

  private group(o: Obj, path: Path): AmountGroup {
    const components = this.objects(this.list(o, 'components', path), [...path, 'components']).map(([c, i]) => {
      const p = [...path, 'components', i]
      const out: AmountComponent = { id: this.id(c, p), name: this.str(c, 'name', p), amount: this.str(c, 'amount', p) }
      if (this.get(c, 'paidByCounterparty') !== undefined) out.paidByCounterparty = this.bool(c, 'paidByCounterparty', p)
      return out
    })
    this.uniqueIds(components, (i) => [...path, 'components', i, 'id'])
    return {
      mode: this.oneOf(o, 'mode', path, ['total', 'components'] as const),
      total: this.str(o, 'total', path),
      components,
    }
  }

  // --- Tags, scenarios and filter views (§8).

  private tag(o: Obj): Tag {
    return { id: this.id(o, []), name: this.str(o, 'name', []) }
  }

  /** Tag names are unique ignoring case (§8.2); the app relies on it to find a tag by name. */
  private uniqueTagNames(tags: Tag[]) {
    tags.forEach((tag, i) => {
      if (tags.slice(0, i).some((t) => sameName(t.name, tag.name))) {
        this.place = { kind: 'tag', index: i, name: tag.name }
        this.report(['name'], { code: 'duplicateTagName', name: tag.name })
      }
    })
    this.place = { kind: 'workspace' }
  }

  /** Tag ids, each at most once and each an existing tag. */
  private tagRefs(o: Obj, key: string, knownTags: Set<string>): string[] {
    const refs = this.strings(o, key, [])
    refs.forEach((id, i) => {
      if (!knownTags.has(id)) this.report([key, i], { code: 'missingRef', target: 'tag', id })
      else if (refs.indexOf(id) !== i) this.report([key, i], { code: 'duplicateTagRef', id })
    })
    return refs
  }

  private scenario(o: Obj, known: Record<'terms' | 'amountSet' | 'tag', Set<string>>): Scenario {
    const ref = (key: string, target: 'terms' | 'amountSet') => {
      const id = this.str(o, key, [])
      if (typeof this.get(o, key) === 'string' && !known[target].has(id)) {
        this.report([key], { code: 'missingRef', target, id })
      }
      return id
    }
    return {
      id: this.id(o, []),
      name: this.str(o, 'name', []),
      termsId: ref('termsId', 'terms'),
      amountSetId: ref('amountSetId', 'amountSet'),
      tagIds: this.tagRefs(o, 'tagIds', known.tag),
      hidden: this.bool(o, 'hidden', []),
      notes: this.str(o, 'notes', []),
      createdAt: this.timestamp(o, 'createdAt'),
    }
  }

  private timestamp(o: Obj, key: string): string {
    const v = this.str(o, key, [])
    if (typeof this.get(o, key) === 'string' && !(ISO_DATE_TIME.test(v) && Number.isFinite(Date.parse(v)))) {
      this.report([key], { code: 'badTimestamp', value: v })
    }
    return v
  }

  private filterView(o: Obj, knownTags: Set<string>): FilterView {
    return {
      id: this.id(o, []),
      name: this.str(o, 'name', []),
      showTagIds: this.tagRefs(o, 'showTagIds', knownTags),
      showMatch: this.oneOf(o, 'showMatch', [], ['any', 'all'] as const),
      hideTagIds: this.tagRefs(o, 'hideTagIds', knownTags),
    }
  }

  // --- Saved sweeps (§9). References to deleted objects are allowed (§9.7).

  private sweep(o: Obj): SavedSweep {
    return {
      id: this.id(o, []),
      name: this.str(o, 'name', []),
      baselineAmountSetId: this.str(o, 'baselineAmountSetId', []),
      termsIds: this.strings(o, 'termsIds', []),
      spec: this.sweepSpec(this.obj(o, 'spec', []), ['spec']),
    }
  }

  private sweepSpec(o: Obj, path: Path): SweepSpec {
    const kind = this.oneOf(o, 'kind', path, ['variable', 'crRange'] as const)
    if (kind === 'crRange') {
      return { kind, from: this.str(o, 'from', path), to: this.str(o, 'to', path), step: this.str(o, 'step', path) }
    }
    if (kind !== 'variable') return UNKNOWN_KIND as SweepSpec
    return {
      kind,
      variable: this.sweepVariable(this.obj(o, 'variable', path), [...path, 'variable']),
      range: this.currencyRange(this.obj(o, 'range', path), [...path, 'range']),
    }
  }

  private sweepVariable(o: Obj, path: Path): SweepVariable {
    const kind = this.oneOf(o, 'kind', path, ['additions', 'deductions', 'component'] as const)
    if (kind === 'additions' || kind === 'deductions') return { kind }
    if (kind !== 'component') return UNKNOWN_KIND as SweepVariable
    return {
      kind,
      group: this.oneOf(o, 'group', path, ['additions', 'deductions'] as const),
      componentId: this.str(o, 'componentId', path),
    }
  }

  private currencyRange(o: Obj, path: Path): CurrencyRange {
    const kind = this.oneOf(o, 'kind', path, ['minMaxStep', 'pctAroundBaseline'] as const)
    if (kind === 'pctAroundBaseline') {
      return { kind, pct: this.str(o, 'pct', path), stepPct: this.str(o, 'stepPct', path) }
    }
    if (kind !== 'minMaxStep') return UNKNOWN_KIND as CurrencyRange
    return {
      kind,
      min: this.str(o, 'min', path),
      max: this.str(o, 'max', path),
      step: this.str(o, 'step', path),
    }
  }
}

/**
 * Stands in for an object whose `kind` was already reported as unknown. Its
 * other fields depend on the kind, so they aren't checked. The workspace is
 * discarded anyway.
 */
const UNKNOWN_KIND = { kind: 'unknown' }

function ids(items: { id: string }[]): Set<string> {
  return new Set(items.map((i) => i.id))
}
