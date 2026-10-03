import { describe, expect, it } from 'vitest'
import { atCR, side, terms, USD } from './__fixtures__/builders'
import { settle } from './settle'
import type { Terms } from './types'
import { validateTerms } from './validateTerms'

const codes = (t: Terms) => validateTerms(t, USD.minorUnits).map((i) => i.code)

describe('validateTerms', () => {
  it('accepts the starter shapes', () => {
    expect(codes(terms('full', { gain: side([['99.0', '50']]), loss: side([['101.0', '30']]) }))).toEqual([])
    expect(codes(terms('gain', { gain: side([['100.0', '50']]) }))).toEqual([])
  })

  it('§6.4.1 CR gain thresholds ≤ 100%, loss thresholds ≥ 100%', () => {
    expect(codes(terms('gain', { gain: side([['100.1', '50']]) }))).toEqual(['gainThresholdAbove100'])
    expect(codes(terms('loss', { loss: side([['99.9', '50']]) }))).toEqual(['lossThresholdBelow100'])
  })

  it('§6.4.2 currency thresholds ≥ 0 and in minor units', () => {
    const cur = (th: string) => terms('gain', { gain: side([[th, '50']]) }, { unit: 'currency' })
    expect(codes(cur('-1'))).toEqual(['thresholdNegative'])
    expect(codes(cur('0'))).toEqual([])
    expect(codes(cur('0.001'))).toEqual(['tooManyDecimals'])
  })

  it('§6.4.3 tiers are strictly ordered away from break-even', () => {
    const gain = terms('gain', { gain: side([['85.0', '50'], ['85.0', '80']]) })
    const issues = validateTerms(gain, 2)
    expect(issues.map((i) => i.code)).toEqual(['thresholdsNotOrdered'])
    expect(issues[0].path).toEqual(['gain', 'tiers', gain.gain!.tiers[1].id, 'threshold'])
    expect(codes(terms('loss', { loss: side([['110.0', '50'], ['105.0', '80']]) }))).toEqual([
      'thresholdsNotOrdered',
    ])
    const cur = terms('loss', { loss: side([['50000', '50'], ['40000', '80']]) }, { unit: 'currency' })
    expect(codes(cur)).toEqual(['thresholdsNotOrdered'])
    const curGain = terms('gain', { gain: side([['100000', '50'], ['100000', '80']]) }, { unit: 'currency' })
    expect(codes(curGain)).toEqual(['thresholdsNotOrdered'])
  })

  it('CR thresholds use the terms’ precision', () => {
    expect(codes(terms('gain', { gain: side([['85.55', '50']]) }))).toEqual(['tooManyDecimals'])
    expect(codes(terms('gain', { gain: side([['85.50', '50']]) }))).toEqual([])
  })

  it('§6.4.4 share % is 0–100 with at most 2 decimals', () => {
    expect(codes(terms('gain', { gain: side([['85.0', '99.999']]) }))).toEqual(['tooManyDecimals'])
    expect(codes(terms('gain', { gain: side([['85.0', '101']]) }))).toEqual(['shareOutOfRange'])
    expect(codes(terms('gain', { gain: side([['85.0', '-1']]) }))).toEqual(['shareOutOfRange'])
    expect(codes(terms('gain', { gain: side([['85.0', '33.33']]) }))).toEqual([])
    expect(codes(terms('gain', { gain: side([['85.0', '']]) }))).toEqual(['invalidNumber'])
  })

  it('§6.4.5 max payout ≥ minimum payout', () => {
    const t = terms('gain', {
      gain: side([['85.0', '100']], {
        maxPayout: '5000',
        minimum: { amount: '6000', behavior: 'deductible' },
      }),
    })
    expect(codes(t)).toEqual(['maxPayoutBelowMinimum'])
  })

  it('checks limits', () => {
    const limited = (limits: Parameters<typeof side>[1]) => codes(terms('gain', { gain: side([['85.0', '100']], limits) }))
    expect(limited({ maxPayout: '-1', maxPayoutPctOfAdditions: '120' })).toEqual(['negativeAmount', 'pctOutOfRange'])
    expect(limited({ minimum: { amount: '-1', behavior: 'deductible' } })).toEqual(['negativeAmount'])
    expect(limited({ maxPayout: '10.005' })).toEqual(['tooManyDecimals'])
    expect(limited({ maxPayoutPctOfAdditions: '2.125' })).toEqual(['tooManyDecimals'])
  })

  it('requires the sides and tiers used by the type, ignoring unused sides', () => {
    expect(codes(terms('full', { gain: side([['99.0', '50']]) }))).toEqual(['missingSide'])
    expect(codes(terms('gain', { gain: side([]) }))).toEqual(['noTiers'])
    expect(codes(terms('gain', { gain: side([['85.0', '50']]), loss: side([['1', 'x']]) }))).toEqual([])
  })

  it('rejects unsupported precisions', () => {
    expect(codes(terms('gain', { gain: side([['85', '50']]) }, { crPrecision: 5 }))).toEqual([
      'invalidPrecision',
    ])
  })

  it('invalid terms make settle return issues tagged with their source (§6.4)', () => {
    const r = settle(terms('gain', { gain: side([['101.0', '50']]) }), atCR('80'), USD)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues).toMatchObject([{ code: 'gainThresholdAbove100', source: 'terms' }])
  })
})
