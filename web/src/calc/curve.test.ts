import { describe, expect, it } from 'vitest'
import { expectOk, side, terms, USD } from './__fixtures__/builders'
import { MAX_CURVE_POINTS, settlementCurve } from './curve'
import { D } from './decimal'

describe('settlementCurve (§10.1)', () => {
  it('marks thresholds and the corridor, and plots signed settlements', () => {
    const full = terms('full', { gain: side([['99.0', '50']]), loss: side([['101.0', '30']]) })
    const c = expectOk(settlementCurve(full, D(1000000), USD))
    expect(c.corridor && [c.corridor.from.toString(), c.corridor.to.toString()]).toEqual(['99', '101'])
    const at = (cr: string) => c.points.find((p) => p.crPct.eq(cr))!.signed.toString()
    expect([at('95'), at('100'), at('105')]).toEqual(['20000', '0', '-12000'])
    expect(c.points[0].crPct.toString()).toBe('84')
    expect(c.points.at(-1)!.crPct.toString()).toBe('116')
    expect(c.points.length).toBe(321)
  })

  it('converts currency thresholds to the CR axis', () => {
    const cur = terms('gain', { gain: side([['100000', '50']]) }, { unit: 'currency' })
    expect(expectOk(settlementCurve(cur, D(1000000), USD)).thresholds[0].crPct.toString()).toBe('90')
  })

  it('caps the number of points and always ends at the range end', () => {
    const fine = terms('gain', { gain: side([['85.0000', '100']]) }, { crPrecision: 4 })
    const c = expectOk(settlementCurve(fine, D(1000000), USD, { from: D(0), to: D('99.9999') }))
    expect(c.points.length).toBeLessThanOrEqual(MAX_CURVE_POINTS)
    expect(c.points.at(-1)!.crPct.toString()).toBe('99.9999')
  })

  it('rejects a reversed range', () => {
    const t = terms('gain', { gain: side([['85.0', '100']]) })
    expect(settlementCurve(t, D(1000000), USD, { from: D(90), to: D(80) })).toMatchObject({
      ok: false,
      issues: [{ code: 'invalidRange' }],
    })
  })
})
