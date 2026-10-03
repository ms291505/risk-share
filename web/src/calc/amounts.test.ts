import { describe, expect, it } from 'vitest'
import { amounts, expectOk } from './__fixtures__/builders'
import { evaluateAmountSet } from './amounts'
import { D } from './decimal'
import type { AmountSet } from './types'

function withComponents(): AmountSet {
  return {
    id: 'a',
    name: 'Components',
    additions: {
      mode: 'components',
      total: '999',
      components: [
        { id: 'prem', name: 'Premiums', amount: '900000', paidByCounterparty: true },
        { id: 'other', name: 'Other', amount: '100000' },
      ],
    },
    deductions: {
      mode: 'components',
      total: '0',
      components: [
        { id: 'claims', name: 'Claims', amount: '850000' },
        { id: 'rebate', name: 'Rebate', amount: '-50000' },
      ],
    },
  }
}

const totalsOf = (set: AmountSet, override?: Parameters<typeof evaluateAmountSet>[2]) => {
  const t = expectOk(evaluateAmountSet(set, 2, override)).totals
  return [t.additions, t.deductions, t.gainLoss, t.counterpartyPaid].map((x) => x.toString())
}
const issueCodes = (set: AmountSet) => {
  const r = evaluateAmountSet(set, 2)
  return r.ok ? [] : r.issues.map((i) => i.code)
}

describe('evaluateAmountSet', () => {
  it('sums active components, including negative ones (§4.3–4.4)', () => {
    expect(totalsOf(withComponents())).toEqual(['1000000', '800000', '200000', '900000'])
  })

  it('ignores inactive components in total mode', () => {
    const set = withComponents()
    set.deductions = { ...set.deductions, mode: 'total', total: '700000' }
    set.deductions.components[0].amount = 'not a number'
    expect(totalsOf(set)[1]).toBe('700000')
  })

  it('uses the optional counterparty-paid field in total mode (§4.6)', () => {
    expect(totalsOf(amounts('100', '50', '40'))[3]).toBe('40')
    expect(totalsOf(amounts('100', '50', ''))[3]).toBe('0')
    expect(totalsOf(amounts('100', '50'))[3]).toBe('0')
  })

  it('§4.5: additions must be > 0; deductions may be zero or negative', () => {
    expect(issueCodes(amounts('0', '0'))).toEqual(['additionsNotPositive'])
    expect(issueCodes(amounts('100', '-50'))).toEqual([])
  })

  it('§4.6: counterparty-paid must be between 0 and total additions', () => {
    expect(issueCodes(amounts('100', '50', '100.01'))).toEqual(['counterpartyPaidOutOfRange'])
    expect(issueCodes(amounts('100', '50', '-1'))).toEqual(['counterpartyPaidOutOfRange'])
  })

  it('rejects unparsable input and fractional minor units (§2.5)', () => {
    expect(issueCodes(amounts('1,000', '0'))).toEqual(['invalidNumber'])
    expect(issueCodes(amounts('100.005', '0'))).toEqual(['tooManyDecimals'])
    const set = withComponents()
    set.additions.components[1].amount = 'x'
    const r = evaluateAmountSet(set, 2)
    expect(!r.ok && r.issues[0].path).toEqual(['additions', 'components', 'other', 'amount'])
  })

  it('a new amount set (additions 0) is invalid (§4.7)', () => {
    expect(issueCodes(amounts('0', '0'))).toContain('additionsNotPositive')
  })

  describe('overrides', () => {
    it('replaces a total, keeping the counterparty-paid amount', () => {
      expect(totalsOf(withComponents(), { kind: 'additions', value: D(950000) })).toEqual([
        '950000', '800000', '150000', '900000',
      ])
    })

    it('replaces a component, including its counterparty-paid share', () => {
      const o = { kind: 'component', group: 'additions', componentId: 'prem', value: D(500000) } as const
      expect(totalsOf(withComponents(), o)).toEqual(['600000', '800000', '-200000', '500000'])
    })

    it('derives deductions from a CR, rounded to the minor unit (§9.3)', () => {
      expect(totalsOf(amounts('1000.01', '1'), { kind: 'costRatio', pct: D('70.0') })[1]).toBe('700.01')
      expect(totalsOf(withComponents(), { kind: 'costRatio', pct: D(70) })[1]).toBe('700000')
    })
  })
})
