import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/v1.json'
import { validateWorkspace, type LoadProblem } from './validate'

type Doc = Record<string, any>

/** The v1 fixture without its version fields, as `parse` hands it to the validator, with an edit applied. */
function edited(edit: (doc: Doc) => void): Doc {
  const { schemaVersion: _v, appVersion: _a, ...doc } = structuredClone(fixture) as Doc
  edit(doc)
  return doc
}

function problems(edit: (doc: Doc) => void): LoadProblem[] {
  const result = validateWorkspace(edited(edit))
  if (result.ok) throw new Error('expected problems')
  return result.problems
}

describe('validateWorkspace (§11.2)', () => {
  it('accepts the fixture, including invalid values and sweeps that point to deleted objects', () => {
    const result = validateWorkspace(edited(() => {}))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.workspace.terms[2].loss?.tiers[0].sharePct).toBe('abc')
    expect(result.workspace.sweeps[0].termsIds).toEqual(['t-full', 't-deleted'])
  })

  it('copies only known fields', () => {
    const doc = edited((d) => {
      d.extra = 1
      d.terms[0].color = 'red'
      d.amountSets[0].additions.components[0].note = 'x'
    })
    const text = JSON.stringify(doc).replace('{', '{"__proto__":{"polluted":true},')
    const result = validateWorkspace(JSON.parse(text))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ws = result.workspace as Doc
    expect(ws.extra).toBeUndefined()
    expect(Object.getPrototypeOf(ws)).toBe(Object.prototype)
    expect(ws.polluted).toBeUndefined()
    expect(ws.terms[0].color).toBeUndefined()
    expect(ws.amountSets[0].additions.components[0]).toEqual({
      id: 'ac1',
      name: 'Premiums',
      amount: '800000.00',
      paidByCounterparty: true,
    })
  })

  it('reports missing fields and wrong types, naming where they are', () => {
    expect(
      problems((d) => {
        delete d.terms[0].name
        d.terms[0].crPrecision = '2'
        d.scenarios[0].hidden = 'yes'
        d.amountSets[1].additions.total = 1000
        d.terms[0].gain.tiers[1].sharePct = null
      }),
    ).toEqual([
      { place: { kind: 'terms', index: 0 }, field: ['name'], code: 'missing' },
      { place: { kind: 'terms', index: 0 }, field: ['crPrecision'], code: 'wrongType', expected: 'number' },
      {
        place: { kind: 'terms', index: 0 },
        field: ['gain', 'tiers', 1, 'sharePct'],
        code: 'wrongType',
        expected: 'text',
      },
      {
        place: { kind: 'amountSet', index: 1, name: 'Budget' },
        field: ['additions', 'total'],
        code: 'wrongType',
        expected: 'text',
      },
      {
        place: { kind: 'scenario', index: 0, name: 'Actuals · full share' },
        field: ['hidden'],
        code: 'wrongType',
        expected: 'boolean',
      },
    ])
  })

  it('rejects a document that is missing whole sections', () => {
    const result = validateWorkspace({})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.map((p) => p.field.join('.'))).toEqual([
      'settings',
      'parties',
      'settings.currency',
      'settings.locale',
      'parties.riskBearer',
      'parties.counterparty',
      'notes',
      'terms',
      'amountSets',
      'tags',
      'scenarios',
      'sweeps',
      'filterViews',
    ])
  })

  it('rejects list items that are not objects', () => {
    expect(problems((d) => d.terms.push('oops'))).toEqual([
      { place: { kind: 'workspace' }, field: ['terms', 3], code: 'wrongType', expected: 'object' },
    ])
  })

  it('rejects unknown enum values', () => {
    const p = problems((d) => {
      d.terms[0].unit = 'percent'
      d.sweeps[0].spec.kind = 'other'
      d.sweeps[1].spec.range.kind = 'other'
      d.filterViews[0].showMatch = 'some'
    })
    expect(p.map((x) => x.code === 'unknownValue' && x.value)).toEqual(['percent', 'other', 'other', 'some'])
  })

  it.each([1.5, -1, Number.MAX_VALUE])('rejects a precision of %s', (crPrecision) => {
    expect(problems((d) => (d.terms[0].crPrecision = crPrecision)).map((p) => p.code)).toEqual(['badPrecision'])
  })

  it('accepts an out-of-range precision, which shows the §6.4 error instead', () => {
    expect(validateWorkspace(edited((d) => (d.terms[0].crPrecision = 99))).ok).toBe(true)
  })

  it('rejects duplicate and empty ids', () => {
    const p = problems((d) => {
      d.terms[1].id = 't-full'
      d.terms[0].gain.tiers[1].id = 'g1'
      d.amountSets[0].deductions.components[1].id = ''
    })
    expect(p.filter((x) => x.code !== 'missingRef')).toEqual([
      {
        place: { kind: 'terms', index: 0, name: 'Full risk share 99% / 101%' },
        field: ['gain', 'tiers', 1, 'id'],
        code: 'duplicateId',
        id: 'g1',
      },
      {
        place: { kind: 'terms', index: 1, name: 'Gain share over €50,000' },
        field: ['id'],
        code: 'duplicateId',
        id: 't-full',
      },
      {
        place: { kind: 'amountSet', index: 0, name: 'Q3 actuals' },
        field: ['deductions', 'components', 1, 'id'],
        code: 'emptyId',
      },
    ])
  })

  it('rejects tag names that differ only by case or spaces (§8.2)', () => {
    expect(problems((d) => (d.tags[2].name = ' optimistic '))).toEqual([
      { place: { kind: 'tag', index: 2, name: ' optimistic ' }, field: ['name'], code: 'duplicateTagName', name: ' optimistic ' },
    ])
  })

  it.each(['usd', 'US Dollar', ''])('rejects the currency %j', (currency) => {
    expect(problems((d) => (d.settings.currency = currency)).map((p) => p.code)).toEqual(['badCurrency'])
  })

  it.each(['', 'not a locale', 'en_US'])('rejects the locale %j', (locale) => {
    expect(problems((d) => (d.settings.locale = locale)).map((p) => p.code)).toEqual(['badLocale'])
  })

  it.each(['2026-10-01', 'yesterday', '2026-10-01T09:00:00', '2026-13-45T00:00:00Z', ''])(
    'rejects the timestamp %j',
    (createdAt) => {
      expect(problems((d) => (d.scenarios[1].createdAt = createdAt)).map((p) => p.code)).toEqual(['badTimestamp'])
    },
  )

  it('rejects references to missing terms, amount sets and tags', () => {
    const p = problems((d) => {
      d.scenarios[0].termsId = 't-gone'
      d.scenarios[0].amountSetId = 'a-gone'
      d.scenarios[0].tagIds = ['tag-opt', 'tag-gone', 'tag-opt']
      d.filterViews[1].hideTagIds = ['tag-gone']
    })
    expect(p.map((x) => [x.place.kind, x.field.join('.'), x.code])).toEqual([
      ['scenario', 'termsId', 'missingRef'],
      ['scenario', 'amountSetId', 'missingRef'],
      ['scenario', 'tagIds.1', 'missingRef'],
      ['scenario', 'tagIds.2', 'duplicateTagRef'],
      ['filterView', 'hideTagIds.0', 'missingRef'],
    ])
  })

  it('names unnamed objects by position', () => {
    expect(problems((d) => (d.scenarios[2] = { ...d.scenarios[2], name: ' ', hidden: 0 }))[0].place).toEqual({
      kind: 'scenario',
      index: 2,
    })
  })
})
