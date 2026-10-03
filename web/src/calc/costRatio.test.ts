import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeCR } from './costRatio'
import { D, round } from './decimal'
import type { RoundingMode } from './types'

const pct = (add: string, ded: string, p: number, mode: RoundingMode) =>
  computeCR(D(add), D(ded), p, mode).roundedPct.toFixed(p)

describe('computeCR', () => {
  it('§6.6.8: 800,500 / 1,000,000 = 80.05%', () => {
    expect(pct('1000000', '800500', 1, 'halfUp')).toBe('80.1')
    expect(pct('1000000', '800500', 1, 'halfEven')).toBe('80.0')
    expect(pct('1000000', '800500', 1, 'truncate')).toBe('80.0')
  })

  it('banker’s rounds half to even on both sides', () => {
    expect(pct('1000000', '801500', 1, 'halfEven')).toBe('80.2')
    expect(pct('1000000', '-801500', 1, 'halfEven')).toBe('-80.2')
    expect(pct('1000000', '-800500', 1, 'halfEven')).toBe('-80.0')
  })

  it('negative CRs: half up away from zero, truncate toward zero', () => {
    expect(pct('1000000', '-800500', 1, 'halfUp')).toBe('-80.1')
    expect(pct('1000000', '-800599', 1, 'truncate')).toBe('-80.0')
    expect(pct('1000000', '-4', 1, 'halfUp')).toBe('0.0')
    expect(pct('1000000', '-500', 1, 'halfUp')).toBe('-0.1')
  })

  it('handles non-terminating ratios and different scales', () => {
    expect(pct('3', '2', 1, 'halfUp')).toBe('66.7')
    expect(pct('3', '2', 1, 'truncate')).toBe('66.6')
    expect(pct('0.03', '2', 0, 'halfUp')).toBe('6667')
    expect(pct('1000000.01', '0', 1, 'halfUp')).toBe('0.0')
  })

  it('supports precision 0', () => {
    expect(pct('1000000', '805000', 0, 'halfUp')).toBe('81')
    expect(pct('1000000', '805000', 0, 'halfEven')).toBe('80')
  })

  it('rejects additions ≤ 0', () => {
    expect(() => computeCR(D(0), D(1), 1, 'halfUp')).toThrow()
  })

  it('matches a high-precision reference for random inputs', () => {
    const ref = D()
    ref.DP = 120
    ref.RM = 0 // truncate the reference quotient; ties are exact for these sizes
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 14n }),
        fc.bigInt({ min: -(10n ** 14n), max: 10n ** 14n }),
        fc.integer({ min: 0, max: 4 }),
        fc.constantFrom<RoundingMode>('halfUp', 'halfEven', 'truncate'),
        (a, d, p, mode) => {
          const add = D(a.toString()).div(100)
          const ded = D(d.toString()).div(100)
          const exact = ref(ded.toString()).times(100).div(ref(add.toString()))
          const expected = round(D(exact.toString()), p, mode)
          expect(computeCR(add, ded, p, mode).roundedPct.eq(expected)).toBe(true)
        },
      ),
    )
  })
})
