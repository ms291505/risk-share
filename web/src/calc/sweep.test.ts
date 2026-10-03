import { describe, expect, it } from 'vitest'
import { amounts, expectOk, side, terms, USD } from './__fixtures__/builders'
import { isInvalid } from './result'
import { buildRange, runSweep, type SweepSpec } from './sweep'
import type { AmountSet } from './types'

const gain85 = terms('gain', { gain: side([['85.0', '100']]) })
const base = amounts('1000000', '800000')
const strs = (xs: ReturnType<typeof buildRange>) => {
  if (isInvalid(xs)) throw new Error(JSON.stringify(xs.issues))
  return xs.map(String)
}

const withComponent = (): AmountSet => ({
  ...amounts('1000000', '0'),
  deductions: {
    mode: 'components',
    total: '0',
    components: [
      { id: 'claims', name: 'Claims', amount: '750000' },
      { id: 'admin', name: 'Admin', amount: '50000' },
    ],
  },
})

const pctSpec = (pct: string, stepPct: string): SweepSpec => ({
  kind: 'variable',
  variable: { kind: 'additions' },
  range: { kind: 'pctAroundBaseline', pct, stepPct },
})

describe('buildRange', () => {
  it('min / max / step, appending max when off-grid', () => {
    const spec: SweepSpec = {
      kind: 'variable',
      variable: { kind: 'deductions' },
      range: { kind: 'minMaxStep', min: '0', max: '25', step: '10' },
    }
    expect(strs(buildRange(base, spec, 2))).toEqual(['0', '10', '20', '25'])
  })

  it('min / max / step must be whole minor units', () => {
    const spec: SweepSpec = {
      kind: 'variable',
      variable: { kind: 'deductions' },
      range: { kind: 'minMaxStep', min: '0', max: '1', step: '0.001' },
    }
    expect(buildRange(base, spec, 2)).toMatchObject({
      ok: false,
      issues: [{ code: 'tooManyDecimals', path: ['range', 'step'], source: 'sweep' }],
    })
  })

  it('±% builds outward from the baseline, symmetric, with ±pct end points (§9.3)', () => {
    const set = amounts('100', '0')
    expect(strs(buildRange(set, pctSpec('5', '3'), 2))).toEqual(['95', '97', '100', '103', '105'])
    expect(strs(buildRange(set, pctSpec('3', '3'), 2))).toEqual(['97', '100', '103'])
    expect(strs(buildRange(set, pctSpec('0', '1'), 2))).toEqual(['100'])
  })

  it('±% values are rounded half up to the minor unit', () => {
    // 1234.57 × 0.97 = 1197.5329; × 1.03 = 1271.6071
    expect(strs(buildRange(amounts('1234.57', '0'), pctSpec('3', '3'), 2))).toEqual(['1197.53', '1234.57', '1271.61'])
  })

  it('caps sweeps at 200 points (§9.4)', () => {
    const tooMany: SweepSpec = { kind: 'crRange', from: '70', to: '110', step: '0.1' }
    expect(buildRange(base, tooMany, 2)).toMatchObject({
      ok: false,
      issues: [{ code: 'tooManyPoints', params: { count: 401, max: 200 } }],
    })
    expect(strs(buildRange(base, { kind: 'crRange', from: '0', to: '199', step: '1' }, 2))).toHaveLength(200)
    expect(buildRange(base, { kind: 'crRange', from: '0', to: '199.5', step: '1' }, 2)).toMatchObject({ ok: false })
    expect(strs(buildRange(base, pctSpec('99', '1'), 2))).toHaveLength(199)
    expect(buildRange(base, pctSpec('99.5', '1'), 2)).toMatchObject({ ok: false })
  })

  it('rejects non-positive steps and reversed ranges', () => {
    expect(buildRange(base, { kind: 'crRange', from: '70', to: '110', step: '0' }, 2)).toMatchObject({
      issues: [{ code: 'invalidStep' }],
    })
    expect(buildRange(base, { kind: 'crRange', from: '110', to: '70', step: '1' }, 2)).toMatchObject({
      issues: [{ code: 'invalidRange' }],
    })
  })

  it('requires an active, existing component (§9.2, §9.7)', () => {
    const spec = (componentId: string): SweepSpec => ({
      kind: 'variable',
      variable: { kind: 'component', group: 'deductions', componentId },
      range: { kind: 'minMaxStep', min: '0', max: '10', step: '5' },
    })
    expect(buildRange(withComponent(), spec('nope'), 2)).toMatchObject({
      issues: [{ code: 'componentNotFound' }],
    })
    const inactive = withComponent()
    inactive.deductions.mode = 'total'
    expect(buildRange(inactive, spec('claims'), 2)).toMatchObject({
      issues: [{ code: 'componentInactive' }],
    })
  })
})

describe('runSweep', () => {
  it('CR range: holds additions fixed and derives deductions (§9.3)', () => {
    const r = expectOk(runSweep(base, [gain85], { kind: 'crRange', from: '70', to: '90', step: '5' }, USD))
    expect(r.axis).toBe('costRatio')
    expect(r.series[0].points.map((p) => p.result.ok && p.result.signed.toString())).toEqual([
      '150000', '100000', '50000', '0', '0',
    ])
    expect(r.series[0].staircase).toBe(false)
  })

  it('sweeps a single component, ignoring the others’ changes', () => {
    const spec: SweepSpec = {
      kind: 'variable',
      variable: { kind: 'component', group: 'deductions', componentId: 'claims' },
      range: { kind: 'minMaxStep', min: '700000', max: '800000', step: '50000' },
    }
    const r = expectOk(runSweep(withComponent(), [gain85], spec, USD))
    expect(r.series[0].points.map((p) => p.result.ok && p.result.cr.roundedPct.toString())).toEqual([
      '75', '80', '85',
    ])
  })

  it('invalid points are gaps (§9.6)', () => {
    const spec: SweepSpec = {
      kind: 'variable',
      variable: { kind: 'additions' },
      range: { kind: 'minMaxStep', min: '-100', max: '100', step: '100' },
    }
    const r = expectOk(runSweep(base, [gain85], spec, USD))
    expect(r.series[0].points.map((p) => p.result.ok)).toEqual([false, false, true])
  })

  it('total-additions sweeps hold counterparty-paid fixed, so points below it are gaps', () => {
    const spec: SweepSpec = {
      kind: 'variable',
      variable: { kind: 'additions' },
      range: { kind: 'minMaxStep', min: '800000', max: '1000000', step: '100000' },
    }
    const r = expectOk(runSweep(amounts('1000000', '800000', '900000'), [gain85], spec, USD))
    const [low, ...rest] = r.series[0].points
    expect(low.result).toMatchObject({ ok: false, issues: [{ code: 'counterpartyPaidOutOfRange' }] })
    expect(rest.map((p) => p.result.ok)).toEqual([true, true])
  })

  it('invalid terms make only their own series invalid (§9.6)', () => {
    const bad = terms('gain', { gain: side([['101.0', '100']]) })
    const r = expectOk(runSweep(base, [bad, gain85], { kind: 'crRange', from: '70', to: '90', step: '10' }, USD))
    expect(r.series[0].points.map((p) => p.result.ok)).toEqual([false, false, false])
    expect(r.series[0].points[0].result).toMatchObject({ issues: [{ code: 'gainThresholdAbove100', source: 'terms' }] })
    expect(r.series[1].points.map((p) => p.result.ok)).toEqual([true, true, true])
    expect(r.series[0].staircase).toBe(false)
  })

  it('flags staircases (§9.5)', () => {
    const staircase = (spec: SweepSpec, t = gain85) => {
      const r = expectOk(runSweep(base, [t], spec, USD))
      return r.series[0].staircase
    }
    // CR range: the step is finer than the precision, even over a short range.
    expect(staircase({ kind: 'crRange', from: '80', to: '81', step: '0.05' })).toBe(true)
    expect(staircase({ kind: 'crRange', from: '80.04', to: '80.06', step: '0.02' })).toBe(true)
    expect(staircase({ kind: 'crRange', from: '80', to: '81', step: '0.1' })).toBe(false)
    // Currency sweeps: consecutive points round to the same CR.
    const currency: SweepSpec = {
      kind: 'variable',
      variable: { kind: 'deductions' },
      range: { kind: 'minMaxStep', min: '800000', max: '801000', step: '200' },
    }
    expect(staircase(currency)).toBe(true)
    expect(staircase(currency, terms('gain', { gain: side([['85.000', '100']]) }, { crPrecision: 3 }))).toBe(false)
    // Currency terms don't settle on the CR.
    expect(staircase(currency, terms('gain', { gain: side([['100000', '50']]) }, { unit: 'currency' }))).toBe(false)
  })

  it('needs at least one set of terms', () => {
    expect(runSweep(base, [], { kind: 'crRange', from: '70', to: '90', step: '5' }, USD)).toMatchObject({
      ok: false,
      issues: [{ code: 'noTerms' }],
    })
  })
})
