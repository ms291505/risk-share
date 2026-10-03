// §6.6 worked examples. Additions are $1,000,000 and CR precision is 1 decimal,
// half up, unless stated otherwise.
import { describe, expect, it } from 'vitest'
import { amounts, atCR, expectOk, side, terms, USD } from './__fixtures__/builders'
import { settle } from './settle'
import type { AmountSet, PartyRole, Settlement, Terms } from './types'

function expectSettlement(
  t: Terms,
  a: AmountSet,
  amount: string,
  payer: PartyRole | null = null,
): Settlement {
  const r = expectOk(settle(t, a, USD))
  expect(r.amount.toString()).toBe(amount)
  expect(r.payer).toBe(payer)
  return r
}

const RB = 'riskBearer'
const CP = 'counterparty'

describe('§6.6.1 gain share (100% below 85.0%)', () => {
  const t = terms('gain', { gain: side([['85.0', '100']]) })
  it('CR 80.0% → Lisa pays Bob $50,000', () => expectSettlement(t, atCR('80'), '50000', RB))
  it('CR 90.0% → $0', () => expectSettlement(t, atCR('90'), '0'))
  it('CR 105.0% → $0', () => expectSettlement(t, atCR('105'), '0'))
})

describe('§6.6.2 loss share (50% above 105.0%)', () => {
  const t = terms('loss', { loss: side([['105.0', '50']]) })
  it('CR 110.0% → Bob pays Lisa $25,000', () => {
    const r = expectSettlement(t, atCR('110'), '25000', CP)
    expect(r.signed.toFixed(0)).toBe('-25000')
  })
  it('CR 95.0% → $0', () => expectSettlement(t, atCR('95'), '0'))
})

describe('§6.6.3 full risk share (50% below 99.0%, 30% above 101.0%)', () => {
  const t = terms('full', { gain: side([['99.0', '50']]), loss: side([['101.0', '30']]) })
  it('CR 105.0% → Bob pays Lisa $12,000', () => expectSettlement(t, atCR('105'), '12000', CP))
  it('CR 95.0% → Lisa pays Bob $20,000', () => expectSettlement(t, atCR('95'), '20000', RB))
  it('CR 100.0% → $0 (corridor)', () => {
    expect(expectSettlement(t, atCR('100'), '0').side).toBe('none')
  })
})

describe('§6.6.4 tiered gain share', () => {
  const t = terms('gain', { gain: side([['85.0', '50'], ['80.0', '80'], ['75.0', '0']]) })
  it('CR 70.0% → $65,000', () => {
    const r = expectSettlement(t, atCR('70'), '65000', RB)
    const tiers = r.trace.filter((s) => s.kind === 'tier')
    expect(tiers.map((s) => s.width.toString())).toEqual(['5', '5', '5'])
    expect(tiers.map((s) => s.amount.toString())).toEqual(['25000', '40000', '0'])
  })
})

describe('§6.6.5 currency terms', () => {
  it('gain share: 50% of gain above $100,000; gain $180,000 → Lisa pays Bob $40,000', () => {
    const t = terms('gain', { gain: side([['100000', '50']]) }, { unit: 'currency' })
    expectSettlement(t, amounts('1000000', '820000'), '40000', RB)
  })
  it('loss share: 50% of loss above $50,000; loss $80,000 → Bob pays Lisa $15,000', () => {
    const t = terms('loss', { loss: side([['50000', '50']]) }, { unit: 'currency' })
    expectSettlement(t, amounts('1000000', '1080000'), '15000', CP)
  })
})

describe('§6.6.6 minimum payout (100% below 85.0%)', () => {
  const aon = terms('gain', {
    gain: side([['85.0', '100']], { minimum: { amount: '60000', behavior: 'allOrNothing' } }),
  })
  it('all-or-nothing $60,000: CR 80.0% → $0', () => expectSettlement(aon, atCR('80'), '0'))
  it('all-or-nothing $60,000: CR 78.0% → $70,000', () =>
    expectSettlement(aon, atCR('78'), '70000', RB))
  it('deductible $10,000: CR 80.0% → $40,000', () => {
    const t = terms('gain', {
      gain: side([['85.0', '100']], { minimum: { amount: '10000', behavior: 'deductible' } }),
    })
    expectSettlement(t, atCR('80'), '40000', RB)
  })
})

describe('§6.6.7 caps', () => {
  it('max $250,000 and 5% of additions: CR 70.0% → $50,000', () => {
    const t = terms('gain', {
      gain: side([['85.0', '100']], { maxPayout: '250000', maxPayoutPctOfAdditions: '5' }),
    })
    const r = expectSettlement(t, atCR('70'), '50000', RB)
    expect(r.trace.find((s) => s.kind === 'tieredTotal')?.amount.toString()).toBe('150000')
  })
})

describe('§6.6.8 rounding: 800,500 / 1,000,000 = 80.05%', () => {
  const a = amounts('1000000', '800500')
  it.each([
    ['halfUp', '80.1'],
    ['halfEven', '80.0'],
    ['truncate', '80.0'],
  ] as const)('%s → %s%%', (mode, expected) => {
    const t = terms('gain', { gain: side([['85.0', '100']]) }, { roundingMode: mode })
    const r = expectOk(settle(t, a, USD))
    expect(r.cr.roundedPct.toFixed(1)).toBe(expected)
    // Settles on the rounded CR (§5.5): (85.0 − CR) pts ÷ 100 × 1,000,000.
    expect(r.amount.toFixed(0)).toBe(expected === '80.1' ? '49000' : '50000')
  })
})

describe('§6.6.9 net position', () => {
  it('Lisa $150,000, Bob −$850,000', () => {
    const t = terms('gain', { gain: side([['85.0', '100']]) })
    const r = expectSettlement(t, amounts('1000000', '800000', '900000'), '50000', RB)
    expect(r.net.riskBearer.toFixed(0)).toBe('150000')
    expect(r.net.counterparty.toFixed(0)).toBe('-850000')
    expect(r.net.hints).toEqual([])
  })
})
