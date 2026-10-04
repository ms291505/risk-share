import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, nameIssues, sameName } from './names'

describe('names (§3.3, §8.2)', () => {
  it('rejects empty and overlong names, after trimming', () => {
    expect(nameIssues('  ', ['x'])).toEqual([{ code: 'nameEmpty', path: ['x'] }])
    expect(nameIssues(` ${'a'.repeat(MAX_NAME_LENGTH)} `, ['x'])).toEqual([])
    expect(nameIssues('a'.repeat(MAX_NAME_LENGTH + 1), ['x'])).toEqual([
      { code: 'nameTooLong', path: ['x'], params: { max: MAX_NAME_LENGTH } },
    ])
  })

  it('counts an emoji as one character', () => {
    expect(nameIssues('😀'.repeat(MAX_NAME_LENGTH), ['x'])).toEqual([])
  })

  it('compares ignoring case and surrounding spaces', () => {
    expect(sameName('Lisa', ' lisa ')).toBe(true)
    expect(sameName('Lisa', 'Lise')).toBe(false)
  })
})
