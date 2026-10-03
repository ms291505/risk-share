import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { amounts, atCR, expectOk, side, terms, USD } from './__fixtures__/builders'
import { makeTotals } from './amounts'
import { D } from './decimal'
import { settle, settleValidated } from './settle'
import { tieredAmount } from './tiers'
import type { AmountSet, Terms } from './types'

const settled = (t: Terms, a: AmountSet, ctx = USD) => expectOk(settle(t, a, ctx))
/** [amount, payer, signed] as strings, for compact assertions. */
const outcome = (t: Terms, a: AmountSet) => {
  const r = settled(t, a)
  return [r.amount.toString(), r.payer, r.signed.toString()]
}

describe('settle', () => {
  it('records the full show-the-math trace (§7.4)', () => {
    const t = terms('gain', {
      gain: side([['85.0', '100']], {
        minimum: { amount: '10000', behavior: 'deductible' },
        maxPayout: '30000',
      }),
    })
    const r = settled(t, atCR('80'))
    expect(r.trace.map((s) => s.kind)).toEqual([
      'totals', 'costRatio', 'side', 'tier', 'tieredTotal', 'minimum', 'cap', 'rounding', 'result',
    ])
    expect(r.amount.toString()).toBe('30000')
  })

  it('rounds the final amount half up to the minor unit (§6.2.4)', () => {
    // 33.33% × 0.1 pts ÷ 100 × 1,000,000.15 = 33.330005 → 33.33
    const t = terms('gain', { gain: side([['85.0', '33.33']]) })
    const r = settled(t, amounts('1000000.15', '849000.13'))
    expect(r.cr.roundedPct.toFixed(1)).toBe('84.9')
    expect(r.amount.toFixed(2)).toBe('333.30')
  })

  it('settles on the rounded CR at other precisions (§5.2, §5.5)', () => {
    // 800,550 / 1,000,000 = 80.055%
    const at = (mode: 'halfUp' | 'truncate') => {
      const t = terms('gain', { gain: side([['85.00', '100']]) }, { crPrecision: 2, roundingMode: mode })
      const r = settled(t, amounts('1000000', '800550'))
      return [r.cr.roundedPct.toFixed(2), r.amount.toString()]
    }
    expect(at('halfUp')).toEqual(['80.06', '49400'])
    expect(at('truncate')).toEqual(['80.05', '49500'])
  })

  it('handles negative cost ratios on the open-ended gain band', () => {
    const r = settled(terms('gain', { gain: side([['85.0', '10']]) }), amounts('1000000', '-150000'))
    expect(r.cr.roundedPct.toString()).toBe('-15')
    expect(r.amount.toString()).toBe('100000') // 10% × 100 pts
  })

  it('exactly at a threshold pays nothing', () => {
    expect(settled(terms('gain', { gain: side([['85.0', '100']]) }), atCR('85')).side).toBe('none')
    const cur = terms('gain', { gain: side([['100000', '50']]) }, { unit: 'currency' })
    expect(settled(cur, amounts('1000000', '900000')).amount.toString()).toBe('0')
  })

  it('reports zero-share tiers as in play with no payer', () => {
    const r = settled(terms('gain', { gain: side([['85.0', '0']]) }), atCR('80'))
    expect([r.side, r.payer, r.amount.toString()]).toEqual(['gain', null, '0'])
  })

  it('flags missing counterparty-paid additions (§4.6)', () => {
    const r = settled(terms('gain', { gain: side([['85.0', '100']]) }), atCR('80'))
    expect(r.net.hints).toEqual(['noCounterpartyPaidAdditions'])
  })

  it('invalid amount sets return issues (§4.7)', () => {
    const r = settle(terms('gain', { gain: side([['85.0', '100']]) }), amounts('0', '0'), USD)
    expect(r).toMatchObject({ ok: false, issues: [{ code: 'additionsNotPositive', source: 'amountSet' }] })
  })
})

describe('tiers', () => {
  it('multi-tier loss side, CR terms (§6.1.3, §6.2)', () => {
    // (50% × 5 + 80% × 5) pts ÷ 100 × 1,000,000
    const t = terms('loss', { loss: side([['105.0', '50'], ['110.0', '80']]) })
    expect(outcome(t, atCR('115'))).toEqual(['65000', 'counterparty', '-65000'])
  })

  it('multi-tier currency side (§6.2)', () => {
    // 50% × 50,000 + 80% × 30,000
    const t = terms('gain', { gain: side([['100000', '50'], ['150000', '80']]) }, { unit: 'currency' })
    expect(outcome(t, amounts('1000000', '820000'))).toEqual(['49000', 'riskBearer', '49000'])
  })

  it('full risk share with currency terms (§6.1.2 corridor)', () => {
    const t = terms(
      'full',
      { gain: side([['100000', '50']]), loss: side([['50000', '30']]) },
      { unit: 'currency' },
    )
    expect(settled(t, amounts('1000000', '950000')).side).toBe('none') // gain 50,000
    expect(settled(t, amounts('1000000', '1020000')).side).toBe('none') // loss 20,000
    expect(outcome(t, amounts('1000000', '820000'))).toEqual(['40000', 'riskBearer', '40000'])
    expect(outcome(t, amounts('1000000', '1080000'))).toEqual(['9000', 'counterparty', '-9000'])
  })
})

describe('limits (§6.3)', () => {
  const gainWithMin = (amount: string, behavior: 'allOrNothing' | 'deductible') =>
    terms('gain', { gain: side([['85.0', '100']], { minimum: { amount, behavior } }) })

  it('all-or-nothing pays in full at exactly the minimum', () => {
    expect(outcome(gainWithMin('50000', 'allOrNothing'), atCR('80'))).toEqual(['50000', 'riskBearer', '50000'])
  })

  it('deductible floors at zero', () => {
    expect(outcome(gainWithMin('60000', 'deductible'), atCR('80'))).toEqual(['0', null, '0'])
  })

  it('compares the minimum with the unrounded amount', () => {
    // tiered = 1.5% × 0.1 pts ÷ 100 × 666,666.33 = 9.99999495, which would round to 10.00
    const t = terms('gain', {
      gain: side([['85.0', '1.5']], { minimum: { amount: '10.00', behavior: 'allOrNothing' } }),
    })
    const r = settled(t, amounts('666666.33', '566000'))
    const min = r.trace.find((s) => s.kind === 'minimum')
    expect(min?.before.toString()).toBe('9.99999495')
    expect(r.amount.toString()).toBe('0')
  })

  it('applies caps on the loss side', () => {
    // tiered 50% × 10 pts = 50,000; caps 20,000 and 1% × 1,000,000 = 10,000
    const t = terms('loss', {
      loss: side([['105.0', '50']], { maxPayout: '20000', maxPayoutPctOfAdditions: '1' }),
    })
    expect(outcome(t, atCR('115'))).toEqual(['10000', 'counterparty', '-10000'])
  })

  it('cap wins over minimum and warns in show-the-math (§6.3.4, §7.4)', () => {
    const t = terms('gain', {
      gain: side([['85.0', '100']], {
        minimum: { amount: '60000', behavior: 'allOrNothing' },
        maxPayoutPctOfAdditions: '5',
      }),
    })
    const r = settled(t, atCR('70'))
    expect(r.amount.toString()).toBe('50000')
    expect(r.warnings).toMatchObject([{ code: 'capBelowMinimum', side: 'gain' }])
    const kinds = r.trace.map((s) => s.kind)
    expect(kinds.slice(kinds.indexOf('cap'))).toEqual(['cap', 'warning', 'rounding', 'result'])
    expect(settled(t, amounts('2000000', '1400000')).warnings).toEqual([])
  })

  it('only warns for the side being settled', () => {
    const t = terms('full', {
      gain: side([['99.0', '100']], {
        minimum: { amount: '60000', behavior: 'allOrNothing' },
        maxPayoutPctOfAdditions: '5',
      }),
      loss: side([['101.0', '50']]),
    })
    expect(settled(t, atCR('110')).warnings).toEqual([])
    expect(settled(t, atCR('100')).warnings).toEqual([])
    expect(settled(t, atCR('90')).warnings).toMatchObject([{ side: 'gain' }])
  })
})

describe('net position (§7.3)', () => {
  it('when the counterparty pays', () => {
    // Loss share 50% above 105.0%, CR 110.0% → Bob pays Lisa 25,000.
    const t = terms('loss', { loss: side([['105.0', '50']]) })
    const r = settled(t, amounts('1000000', '1100000', '900000'))
    expect(r.signed.toString()).toBe('-25000')
    expect(r.net.riskBearer.toString()).toBe('-75000') // 1,000,000 − 1,100,000 + 25,000
    expect(r.net.counterparty.toString()).toBe('-925000') // −900,000 − 25,000
  })
})

describe('properties', () => {
  const pctArb = fc.integer({ min: 0, max: 10000 }).map((n) => D(n).div(100).toFixed(2))
  const additionsArb = fc.integer({ min: 1, max: 10 ** 9 }).map(String)
  const crArb = fc.integer({ min: -500, max: 3000 }) // tenths of a percent

  // Gain tiers: up to 3 distinct descending thresholds in [0, 100]; loss: ascending in [100, 300].
  const tiersArb = (lo: number, hi: number, desc: boolean) =>
    fc
      .uniqueArray(fc.integer({ min: lo * 10, max: hi * 10 }), { minLength: 1, maxLength: 3 })
      .chain((ts) =>
        fc.tuple(
          fc.constant(ts.sort((a, b) => (desc ? b - a : a - b))),
          fc.array(pctArb, { minLength: ts.length, maxLength: ts.length }),
        ),
      )
      .map(([ts, shares]) => side(ts.map((t, i) => [D(t).div(10).toFixed(1), shares[i]])))

  const fullTermsArb = fc
    .tuple(tiersArb(0, 100, true), tiersArb(100, 300, false))
    .map(([gain, loss]) => terms('full', { gain, loss }))

  const totalsAt = (add: string, crTenths: number) =>
    makeTotals(D(add), D(add).times(crTenths).div(1000), D(0))

  const tiered = (t: Terms, add: string, crTenths: number) => {
    const totals = totalsAt(add, crTenths)
    const cr = D(crTenths).div(10)
    return tieredAmount('gain', t.gain!, 'costRatio', totals, cr).amount.plus(
      tieredAmount('loss', t.loss!, 'costRatio', totals, cr).amount,
    )
  }

  it('marginal tiers are continuous and monotone in CR distance from break-even', () => {
    fc.assert(
      fc.property(fullTermsArb, additionsArb, crArb, (t, add, cr) => {
        const a = tiered(t, add, cr)
        const b = tiered(t, add, cr + 1)
        // One 0.1-pt step changes the amount by at most 100% × 0.1 pts ÷ 100 × additions.
        expect(b.minus(a).abs().lte(D(add).div(1000))).toBe(true)
        if (cr >= 1000) expect(b.gte(a)).toBe(true)
        if (cr < 1000) expect(b.lte(a)).toBe(true)
      }),
    )
  })

  it('never exceeds either cap; signed matches the direction', () => {
    const capArb = fc.integer({ min: 0, max: 10 ** 8 }).map(String)
    fc.assert(
      fc.property(fullTermsArb, additionsArb, crArb, capArb, pctArb, (t, add, cr, cap, capPct) => {
        t.gain!.limits = { maxPayout: cap, maxPayoutPctOfAdditions: capPct }
        t.loss!.limits = { maxPayout: cap, maxPayoutPctOfAdditions: capPct }
        const totals = makeTotals(D(add), D(add).times(cr).div(1000).round(2), D(0))
        const r = settleValidated(t, totals, USD)
        expect(r.amount.lte(D(cap))).toBe(true)
        expect(r.amount.lte(D(capPct).div(100).times(add).round(2))).toBe(true)
        if (r.payer === 'riskBearer') expect(r.signed.gt(0)).toBe(true)
        if (r.payer === 'counterparty') expect(r.signed.lt(0)).toBe(true)
        if (r.payer === null) expect(r.signed.eq(0)).toBe(true)
        expect(r.net.riskBearer.plus(r.net.counterparty).eq(totals.gainLoss)).toBe(true)
      }),
    )
  })

  it('a single 100% tier pays the excess × additions', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), additionsArb, crArb, (t10, add, cr) => {
        const gain = terms('gain', { gain: side([[D(t10).div(10).toFixed(1), '100']]) })
        const r = settleValidated(gain, totalsAt(add, cr), USD)
        const excess = Math.max(0, t10 - cr)
        expect(r.amount.eq(D(excess).div(1000).times(add).round(2))).toBe(true)
      }),
    )
  })
})
