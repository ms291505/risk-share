import { describe, expect, it } from 'vitest'
import type { LoadProblem } from '../io/validate'
import { loadErrorMessage, MAX_LISTED_PROBLEMS, problemMessage } from './loadErrors'

describe('load error messages (§11.2)', () => {
  it('names the object and field', () => {
    expect(
      problemMessage({
        place: { kind: 'scenario', index: 3, name: 'Base · Q3' },
        field: ['termsId'],
        code: 'missingRef',
        target: 'terms',
        id: 't9',
      }),
    ).toBe('Scenario "Base · Q3", termsId: refers to terms that aren\'t in the file ("t9").')
    expect(
      problemMessage({
        place: { kind: 'terms', index: 0 },
        field: ['gain', 'tiers', 1, 'sharePct'],
        code: 'wrongType',
        expected: 'text',
      }),
    ).toBe('Terms 1, gain › tiers 2 › sharePct: should be text.')
    expect(problemMessage({ place: { kind: 'workspace' }, field: [], code: 'missing' })).toBe('The workspace: is missing.')
  })

  it('lists the first few problems and counts the rest', () => {
    const problem: LoadProblem = { place: { kind: 'workspace' }, field: ['notes'], code: 'missing' }
    const { details } = loadErrorMessage({ kind: 'invalid', problems: Array(MAX_LISTED_PROBLEMS + 2).fill(problem) })
    expect(details).toHaveLength(MAX_LISTED_PROBLEMS + 1)
    expect(details.at(-1)).toBe('…and 2 more.')
  })

  it('names the app version a newer file needs', () => {
    expect(loadErrorMessage({ kind: 'newerVersion', schemaVersion: 2, appVersion: '0.4.0' }).details[0]).toMatch(
      /^It needs Risk Share 0\.4\.0 or later; this is \d+\.\d+\.\d+\./,
    )
  })
})
