import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../state/workspace'
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
