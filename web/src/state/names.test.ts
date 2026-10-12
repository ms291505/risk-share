import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH, nameIssues, nameLength, sameName, withSuffix } from './names'

describe('names (§3.3, §8.2)', () => {
  it('rejects empty and overlong names, after trimming', () => {
    expect(nameIssues('  ', ['x'])).toEqual([{ code: 'nameEmpty', path: ['x'] }])
    expect(nameIssues(` ${'a'.repeat(MAX_NAME_LENGTH)} `, ['x'])).toEqual([])
    expect(nameIssues('a'.repeat(MAX_NAME_LENGTH + 1), ['x'])).toEqual([
      { code: 'nameTooLong', path: ['x'], params: { max: MAX_NAME_LENGTH } },
    ])
  })

  it('counts an emoji as one character, even a combined one', () => {
    for (const emoji of ['😀', '👨‍👩‍👧', '👍🏽', '🇺🇸']) {
      expect(nameIssues(emoji.repeat(MAX_NAME_LENGTH), ['x'])).toEqual([])
      expect(nameIssues(emoji.repeat(MAX_NAME_LENGTH + 1), ['x'])[0].code).toBe('nameTooLong')
    }
  })

  it('compares ignoring case and surrounding spaces', () => {
    expect(sameName('Lisa', ' lisa ')).toBe(true)
    expect(sameName('Lisa', 'Lise')).toBe(false)
  })
})

describe('withSuffix', () => {
  it('shortens the name so the result stays within the limit', () => {
    expect(withSuffix('Budget', ' (copy)')).toBe('Budget (copy)')
    const result = withSuffix(`${'a'.repeat(70)} ${'b'.repeat(9)}`, ' (copy)')
    expect(nameLength(result)).toBe(MAX_NAME_LENGTH)
    expect(withSuffix(`${'a'.repeat(72)} bbbb`, ' (copy)')).toBe(`${'a'.repeat(72)} (copy)`)
    expect(withSuffix('  ', ' (copy)')).toBe('(copy)')
  })
})
