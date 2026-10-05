import { describe, expect, it } from 'vitest'
import { expectOk, side, terms, USD } from './__fixtures__/builders'
import { curveBreakpoints, MAX_CURVE_POINTS, settlementCurve, type CurvePoint } from './curve'
import { D, niceStep } from './decimal'

const str = (points: CurvePoint[]) => points.map((p) => [p.x.toString(), p.signed.toString()])

describe('settlementCurve (§10.1)', () => {
  it('marks thresholds and the corridor, and plots signed settlements', () => {
    const full = terms('full', { gain: side([['99.0', '50']]), loss: side([['101.0', '30']]) })
    const c = expectOk(settlementCurve(full, D(1000000), USD))
    expect(c.axis).toBe('costRatio')
    expect(c.corridor && [c.corridor.from.toString(), c.corridor.to.toString()]).toEqual(['99', '101'])
    const at = (cr: string) => c.points.find((p) => p.x.eq(cr))!.signed.toString()
    expect([at('95'), at('100'), at('105')]).toEqual(['20000', '0', '-12000'])
    expect(c.points[0].x.toString()).toBe('84')
    expect(c.points.at(-1)!.x.toString()).toBe('116')
    expect(c.points.length).toBe(321)
  })

  it('caps the number of points and always ends at the range end', () => {
    const fine = terms('gain', { gain: side([['85.0000', '100']]) }, { crPrecision: 4 })
    const c = expectOk(settlementCurve(fine, D(1000000), USD, { from: D(0), to: D('99.9999') }))
    expect(c.points.length).toBeLessThanOrEqual(MAX_CURVE_POINTS)
    expect(c.points.at(-1)!.x.toString()).toBe('99.9999')
  })

  it('starts at 0% at the lowest, since deductions are never negative', () => {
    const low = terms('gain', { gain: side([['10.0', '50']]) })
    const c = expectOk(settlementCurve(low, D(1000000), USD))
    expect([c.points[0].x.toString(), c.points.at(-1)!.x.toString()]).toEqual(['0', '25'])
    expect(settlementCurve(low, D(1000000), USD, { from: D(-5), to: D(20) })).toMatchObject({
      ok: false,
      issues: [{ code: 'rangeBelowZero' }],
    })
  })

  it('rejects a reversed range', () => {
    const t = terms('gain', { gain: side([['85.0', '100']]) })
    expect(settlementCurve(t, D(1000000), USD, { from: D(90), to: D(80) })).toMatchObject({
      ok: false,
      issues: [{ code: 'invalidRange' }],
    })
  })
})

describe('settlementCurve on the currency axis', () => {
  const full = terms(
    'full',
    { gain: side([['100000', '50']]), loss: side([['50000', '50']]) },
    { unit: 'currency' },
  )

  it('plots gain/loss with thresholds at their entered amounts (§6.6.5)', () => {
    const c = expectOk(settlementCurve(full, D(1000000), USD))
    expect(c.axis).toBe('currency')
    expect(c.thresholds.map((t) => t.x.toString())).toEqual(['100000', '-50000'])
    expect(c.corridor && [c.corridor.from.toString(), c.corridor.to.toString()]).toEqual(['-50000', '100000'])
    const at = (x: string) => c.points.find((p) => p.x.eq(x))!.signed.toString()
    expect([at('170000'), at('-80000'), at('0')]).toEqual(['35000', '-15000', '0'])
    // Half the threshold span as margin on each side.
    expect([c.points[0].x.toString(), c.points.at(-1)!.x.toString()]).toEqual(['-125000', '175000'])
    expect(c.points.length).toBeLessThanOrEqual(MAX_CURVE_POINTS)
  })

  it("doesn't move thresholds when the preview additions change", () => {
    const small = expectOk(settlementCurve(full, D(1000), USD))
    expect(small.thresholds.map((t) => t.x.toString())).toEqual(['100000', '-50000'])
  })

  it('stops at a gain equal to the additions, so deductions are never negative', () => {
    const c = expectOk(settlementCurve(full, D(120000), USD))
    expect(c.points.at(-1)!.x.toString()).toBe('120000')
    // With $1,000 of additions the gain threshold can't be reached, so only the loss side sets the range.
    const small = expectOk(settlementCurve(full, D(1000), USD))
    expect([small.points[0].x.toString(), small.points.at(-1)!.x.toString()]).toEqual(['-75000', '1000'])
  })

  it('rejects an explicit range past the additions', () => {
    expect(settlementCurve(full, D(1000), USD, { from: D(-1000), to: D(2000) })).toMatchObject({
      ok: false,
      issues: [{ code: 'rangeAboveAdditions' }],
    })
  })

  it('includes off-grid thresholds as exact points', () => {
    const odd = terms('gain', { gain: side([['12345.67', '100']]) }, { unit: 'currency' })
    const c = expectOk(settlementCurve(odd, D(1000000), USD))
    expect(c.points.some((p) => p.x.eq('12345.67'))).toBe(true)
    const xs = c.points.map((p) => p.x)
    expect(xs.every((x, i) => i === 0 || x.gt(xs[i - 1]))).toBe(true)
  })

  it('falls back to ±10% of additions when every threshold is at break-even', () => {
    const zero = terms('gain', { gain: side([['0', '100']]) }, { unit: 'currency' })
    const c = expectOk(settlementCurve(zero, D(1000000), USD))
    expect([c.points[0].x.toString(), c.points.at(-1)!.x.toString()]).toEqual(['-100000', '100000'])
  })
})

describe('niceStep', () => {
  it('rounds up to 1, 2 or 5 × 10ⁿ', () => {
    expect([0.03, 1, 1.5, 3, 7, 420].map((x) => niceStep(x).toString())).toEqual(['0.05', '1', '2', '5', '10', '500'])
  })

  it('ignores float noise just above a nice step', () => {
    expect(niceStep((85.3 - 84.9) / 8).toString()).toBe('0.05')
    expect(niceStep(0.1 + 0.2 - 0.1).toString()).toBe('0.2')
  })
})

describe('curveBreakpoints (§13.3)', () => {
  it('keeps the ends and the points where the slope changes', () => {
    const t = terms('gain', { gain: side([['85.0', '50'], ['80.0', '80']]) })
    const c = expectOk(settlementCurve(t, D(1000000), USD, { from: D(70), to: D(90) }))
    expect(str(curveBreakpoints(c.points))).toEqual([
      ['70', '105000'],
      ['80', '25000'],
      ['85', '0'],
      ['90', '0'],
    ])
  })

  // Settlements round to cents, so the rounded values wobble along a straight segment.
  it('ignores cent rounding with non-round additions and shares', () => {
    const t = terms('gain', { gain: side([['85.0', '33.33']]) })
    const c = expectOk(settlementCurve(t, D('1234567.89'), USD))
    expect(curveBreakpoints(c.points).map((p) => p.x.toString())).toEqual(['70', '85', '100'])

    const currency = terms('gain', { gain: side([['12345.67', '33.33']]) }, { unit: 'currency' })
    const cc = expectOk(settlementCurve(currency, D(1000000), USD))
    const ends = [cc.points[0].x.toString(), cc.points.at(-1)!.x.toString()]
    expect(curveBreakpoints(cc.points).map((p) => p.x.toString())).toEqual([ends[0], '12345.67', ends[1]])
  })

  it('shows an off-grid cap kink as the plotted points either side of it', () => {
    // 33.33% of the gain reaches the 1,000 cap at a gain of 3,000.30…
    const capped = terms('gain', { gain: side([['0', '33.33']], { maxPayout: '1000' }) }, { unit: 'currency' })
    const c = expectOk(settlementCurve(capped, D(10000), USD, { from: D(-1000), to: D(5000) }))
    expect(curveBreakpoints(c.points).map((p) => p.x.toString())).toEqual(['-1000', '0', '3000', '3010', '5000'])
  })

  it('finds cap kinks', () => {
    const capped = terms('gain', { gain: side([['85.0', '100']], { maxPayout: '50000' }) })
    const c = expectOk(settlementCurve(capped, D(1000000), USD, { from: D(70), to: D(90) }))
    expect(str(curveBreakpoints(c.points)).map(([x]) => x)).toEqual(['70', '80', '85', '90'])
  })
})
