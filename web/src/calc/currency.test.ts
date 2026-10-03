import { describe, expect, it } from 'vitest'
import { minorUnits } from './currency'

describe('minorUnits', () => {
  it('follows the currency', () => {
    expect([minorUnits('USD'), minorUnits('JPY'), minorUnits('EUR'), minorUnits('KWD')]).toEqual([2, 0, 2, 3])
  })
})
