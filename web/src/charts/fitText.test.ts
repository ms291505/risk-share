import { describe, expect, it } from 'vitest'
import { fitText } from './fitText'

// 10px per character.
const measure = (s: string) => [...s].length * 10

describe('fitText', () => {
  it('leaves text that fits', () => {
    expect(fitText('Lisa pays Bob', 130, measure)).toBe('Lisa pays Bob')
  })

  it('shortens with an ellipsis to fit', () => {
    expect(fitText('Lisa pays Bob', 60, measure)).toBe('Lisa…')
  })

  it("doesn't split an emoji or leave a space before the ellipsis", () => {
    expect(fitText('ab 😀😀😀', 40, measure)).toBe('ab…')
    expect(fitText('ab😀😀😀', 40, measure)).toBe('ab😀…')
  })

  it('leaves text alone when it cannot be measured', () => {
    expect(fitText('Lisa pays Bob', 10, () => null)).toBe('Lisa pays Bob')
  })
})
