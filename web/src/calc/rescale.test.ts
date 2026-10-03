import { describe, expect, it } from 'vitest'
import { amounts, side, terms } from './__fixtures__/builders'
import {
  applyPrecisionChange,
  previewCurrencyChange,
  previewPrecisionChange,
  rescaleAmount,
  rescaleAmountSet,
  rescaleSweepSpec,
  rescaleTerms,
} from './rescale'
import type { SweepSpec } from './sweep'
import { validateTerms } from './validateTerms'

describe('currency change (§2.3)', () => {
  const sweep: SweepSpec = {
    kind: 'variable',
    variable: { kind: 'deductions' },
    range: { kind: 'minMaxStep', min: '0.40', max: '1000.50', step: '0.50' },
  }

  it('counts and rounds every stored amount half up', () => {
    const set = amounts('1000.50', '999.49', '0.50')
    set.deductions.components = [{ id: 'c', name: 'Inactive', amount: '1.00' }]
    const t = terms('gain', { gain: side([['100.25', '50']], { maxPayout: '10' }) }, { unit: 'currency' })
    expect(previewCurrencyChange(0, { amountSets: [set], terms: [t], sweeps: [sweep] })).toEqual({ rounded: 7 })
    const r = rescaleAmountSet(set, 0)
    expect([r.additions.total, r.deductions.total, r.additions.paidByCounterparty]).toEqual(['1001', '999', '1'])
    expect(r.deductions.components[0].amount).toBe('1')
    const rt = rescaleTerms(t, 0)
    expect([rt.gain!.tiers[0].threshold, rt.gain!.limits.maxPayout]).toEqual(['100', '10'])
  })

  it('rounds saved sweep ranges', () => {
    const r = rescaleSweepSpec(sweep, 0)
    expect(r.kind === 'variable' && r.range).toMatchObject({ min: '0', max: '1001', step: '1' })
    const cr: SweepSpec = { kind: 'crRange', from: '70.5', to: '110', step: '0.5' }
    expect(rescaleSweepSpec(cr, 0)).toBe(cr)
  })

  it('rounds negative halves away from zero', () => {
    expect([rescaleAmount('-0.50', 0), rescaleAmount('-1.49', 0), rescaleAmount('0.50', 0)]).toEqual(['-1', '-1', '1'])
  })

  it('increasing the minor unit changes no values', () => {
    const set = amounts('1000', '999', '5')
    expect(previewCurrencyChange(2, { amountSets: [set] })).toEqual({ rounded: 0 })
    const r = rescaleAmountSet(set, 2)
    expect([r.additions.total, r.deductions.total, r.additions.paidByCounterparty]).toEqual([
      '1000.00', '999.00', '5.00',
    ])
  })

  it('leaves CR thresholds and percentages alone', () => {
    const t = terms('gain', { gain: side([['85.5', '33.33']], { maxPayoutPctOfAdditions: '2.5' }) })
    expect(previewCurrencyChange(0, { terms: [t] })).toEqual({ rounded: 0 })
    expect(rescaleTerms(t, 0)).toEqual(t)
  })
})

describe('precision change (§5.6)', () => {
  const t = terms('full', { gain: side([['85.55', '50']]), loss: side([['105.10', '50']]) }, { crPrecision: 2 })

  it('lists thresholds that will change', () => {
    expect(previewPrecisionChange(t, 1)).toMatchObject([{ side: 'gain', from: '85.55', to: '85.6' }])
  })

  it('applies the new precision', () => {
    const r = applyPrecisionChange(t, 1)
    expect([r.crPrecision, r.gain!.tiers[0].threshold, r.loss!.tiers[0].threshold]).toEqual([1, '85.6', '105.1'])
    expect(applyPrecisionChange(r, 2).gain!.tiers[0].threshold).toBe('85.60')
  })

  it('tiers that collapse onto one value fail validation afterwards', () => {
    const tiered = terms('gain', { gain: side([['85.04', '50'], ['85.01', '80']]) }, { crPrecision: 2 })
    expect(previewPrecisionChange(tiered, 1).map((c) => c.to)).toEqual(['85.0', '85.0'])
    expect(validateTerms(applyPrecisionChange(tiered, 1), 2).map((i) => i.code)).toEqual(['thresholdsNotOrdered'])
  })
})
