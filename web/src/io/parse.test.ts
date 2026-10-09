import { describe, expect, it } from 'vitest'
import { emptyWorkspace, SCHEMA_VERSION } from '../state/workspace'
import { parseWorkspaceText } from './parse'
import { serializeWorkspace } from './serialize'

const fixtures = import.meta.glob<string>('./__fixtures__/v*.json', { query: '?raw', import: 'default', eager: true })

describe('parseWorkspaceText (§11.2)', () => {
  it('has a fixture of the current version', () => {
    expect(Object.keys(fixtures)).toContain(`./__fixtures__/v${SCHEMA_VERSION}.json`)
  })

  it.each(Object.entries(fixtures))('opens the frozen fixture %s', (_, text) => {
    expect(parseWorkspaceText(text).ok).toBe(true)
  })

  it('round-trips the current fixture through the serializer', () => {
    const text = fixtures[`./__fixtures__/v${SCHEMA_VERSION}.json`]
    const parsed = parseWorkspaceText(text)
    if (!parsed.ok) throw new Error('fixture should parse')
    expect(parsed.appVersion).toBe('0.1.0')
    expect(parsed.migratedFrom).toBeUndefined()
    const { appVersion: _a, ...expected } = JSON.parse(text)
    const { appVersion, ...actual } = JSON.parse(serializeWorkspace(parsed.workspace))
    expect(actual).toEqual(expected)
    expect(appVersion).toBe(__APP_VERSION__)
  })

  it('round-trips an empty workspace', () => {
    const ws = emptyWorkspace('en-GB')
    expect(parseWorkspaceText(serializeWorkspace(ws, 0))).toEqual({ ok: true, workspace: ws, appVersion: __APP_VERSION__ })
  })

  it('rejects text that is not JSON', () => {
    expect(parseWorkspaceText('{"schemaVersion": 1,')).toEqual({ ok: false, error: { kind: 'notJson' } })
  })

  it.each(['[]', 'null', '42', '{}', '{"schemaVersion":"1"}', '{"schemaVersion":1.5}', '{"schemaVersion":0}'])(
    'rejects %s as not a workspace',
    (text) => {
      expect(parseWorkspaceText(text)).toEqual({ ok: false, error: { kind: 'notAWorkspace' } })
    },
  )

  it('rejects a newer version, naming the app version it needs', () => {
    const text = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, appVersion: '9.0.0' })
    expect(parseWorkspaceText(text)).toEqual({
      ok: false,
      error: { kind: 'newerVersion', schemaVersion: SCHEMA_VERSION + 1, appVersion: '9.0.0' },
    })
    expect(parseWorkspaceText(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, appVersion: 9 }))).toEqual({
      ok: false,
      error: { kind: 'newerVersion', schemaVersion: SCHEMA_VERSION + 1 },
    })
  })

  it('migrates an older version before validating', () => {
    const { schemaVersion: _v, ...rest } = emptyWorkspace('en-US')
    const old = { schemaVersion: SCHEMA_VERSION - 1, ...rest, partyNames: rest.parties, parties: undefined }
    const chain = { [SCHEMA_VERSION - 1]: ({ partyNames, ...d }: Record<string, unknown>) => ({ ...d, parties: partyNames }) }
    expect(parseWorkspaceText(JSON.stringify(old), chain)).toEqual({
      ok: true,
      workspace: emptyWorkspace('en-US'),
      migratedFrom: SCHEMA_VERSION - 1,
    })
  })

  it('reports a migration that fails', () => {
    const chain = {
      [SCHEMA_VERSION - 1]: () => {
        throw new TypeError('bad')
      },
    }
    expect(parseWorkspaceText(JSON.stringify({ schemaVersion: SCHEMA_VERSION - 1 }), chain)).toEqual({
      ok: false,
      error: { kind: 'migrationFailed', schemaVersion: SCHEMA_VERSION - 1 },
    })
  })

  it('reports every validation problem', () => {
    const text = JSON.stringify({ ...JSON.parse(serializeWorkspace(emptyWorkspace('en-US'))), notes: 1, tags: {} })
    const result = parseWorkspaceText(text)
    expect(result.ok || result.error.kind === 'invalid' && result.error.problems.map((p) => p.field[0])).toEqual([
      'notes',
      'tags',
    ])
  })
})
