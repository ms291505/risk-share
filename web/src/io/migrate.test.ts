import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../state/workspace'
import v1 from './__fixtures__/v1.json'
import v2 from './__fixtures__/v2.json'
import { MIGRATIONS, migrate } from './migrate'

describe('migrate (§11.2)', () => {
  it('has a migration from every older version', () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) expect(MIGRATIONS[v], `migration from ${v}`).toBeTypeOf('function')
  })

  it('runs each step in order and stamps the version', () => {
    const chain = {
      0: (d: Record<string, unknown>) => ({ ...d, steps: ['0→1'] }),
      1: (d: Record<string, unknown>) => ({ ...d, steps: [...((d.steps as string[]) ?? []), '1→2'] }),
    }
    expect(migrate({ a: 1 }, 0, chain, 2)).toEqual({ a: 1, steps: ['0→1', '1→2'], schemaVersion: 2 })
    expect(migrate({ a: 1 }, 1, chain, 2)).toEqual({ a: 1, steps: ['1→2'], schemaVersion: 2 })
  })

  it('leaves a current document alone', () => {
    const doc = { a: 1 }
    expect(migrate(doc, SCHEMA_VERSION)).toBe(doc)
  })

  it('throws when a step is missing', () => {
    expect(() => migrate({}, 0, { 1: (d) => d }, 2)).toThrow('No migration from schema version 0')
  })
})

describe('v1 → v2: the counterparty-paid amount moves to components (§4.6)', () => {
  const v1 = (additions: Record<string, unknown>, counterparty = 'Bob') => ({
    settings: { currency: 'EUR', locale: 'de-DE' },
    parties: { riskBearer: 'Lisa', counterparty },
    amountSets: [{ id: 'a', name: 'A', additions, deductions: { mode: 'total', total: '0', components: [] } }],
  })
  const additionsAfter = (additions: Record<string, unknown>, counterparty?: string) =>
    (migrate(v1(additions, counterparty), 1, MIGRATIONS, 2).amountSets as { additions: Record<string, unknown> }[])[0]
      .additions
  const total = (paidByCounterparty: string, totalText = '1000.00') => ({
    mode: 'total',
    total: totalText,
    paidByCounterparty,
    components: [{ id: 'old', name: 'Inactive', amount: '1' }],
  })

  it('splits a total into what the counterparty paid and the rest, so results are unchanged', () => {
    expect(additionsAfter(total('400.50'))).toEqual({
      mode: 'components',
      total: '1000.00',
      components: [
        { id: expect.any(String), name: 'Paid by Bob', amount: '400.50', paidByCounterparty: true },
        { id: expect.any(String), name: 'Other additions', amount: '599.50' },
      ],
    })
  })

  it('makes one marked component when the counterparty paid it all', () => {
    expect(additionsAfter(total('1000')).components).toEqual([
      { id: expect.any(String), name: 'Paid by Bob', amount: '1000', paidByCounterparty: true },
    ])
  })

  it('splits a paid amount above the total, so the range error shows', () => {
    expect(additionsAfter(total('1500')).components).toMatchObject([{ amount: '1500' }, { amount: '-500.00' }])
  })

  it('splits exactly when an amount has too many decimals, so the sum stays right', () => {
    expect(additionsAfter(total('400.005')).components).toMatchObject([{ amount: '400.005' }, { amount: '599.995' }])
  })

  it('leaves the rest blank when an amount is not a number, keeping the old total in its name', () => {
    expect(additionsAfter(total('abc')).components).toMatchObject([
      { amount: 'abc' },
      { name: 'Other additions (total was 1.000,00)', amount: '' },
    ])
    expect(additionsAfter(total('5', 'x')).components).toMatchObject([
      { amount: '5' },
      { name: 'Other additions (total was x)', amount: '' },
    ])
  })

  it.each([
    ['blank', ''],
    ['zero', '0.00'],
  ])('drops a %s amount, leaving the total as it was', (_, paid) => {
    const { paidByCounterparty: _p, ...rest } = total(paid)
    expect(additionsAfter(total(paid))).toEqual(rest)
  })

  it('drops the amount where components were in use, since it was inactive', () => {
    const components = { mode: 'components', total: '0', paidByCounterparty: '5', components: [] }
    expect(additionsAfter(components)).toEqual({ mode: 'components', total: '0', components: [] })
  })

  it('keeps the names it makes within the 80-character limit', () => {
    const [paid] = additionsAfter(total('400'), 'N'.repeat(80)).components as { name: string }[]
    expect(paid.name).toBe(`Paid by ${'N'.repeat(72)}`)
    const [, rest] = additionsAfter(total('abc', 'x'.repeat(70))).components as { name: string }[]
    expect(rest.name).toBe('Other additions')
  })

  it('names the counterparty by role when its name is blank', () => {
    const [paid] = additionsAfter(total('400'), ' ').components as { name: string }[]
    expect(paid.name).toBe('Paid by Counterparty')
  })
})

describe('the frozen fixtures', () => {
  it('migrate from v1 to exactly v2, apart from generated ids', () => {
    const { schemaVersion, ...doc } = v1
    const migrated = migrate(doc, schemaVersion, MIGRATIONS, 2)
    const expected = structuredClone(v2)
    for (const c of expected.amountSets[1].additions.components) c.id = expect.any(String)
    expect(migrated).toEqual(expected)
  })
})
