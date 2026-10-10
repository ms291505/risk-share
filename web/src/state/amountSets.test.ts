import { describe, expect, it } from 'vitest'
import type { AmountComponent, AmountSet } from '../calc'
import { amounts } from '../calc/__fixtures__/builders'
import {
  deleteAmountSet,
  deleteImpact,
  duplicateAmountSet,
  newAmountSet,
  newComponent,
  switchGroupMode,
} from './amountSets'
import { emptyWorkspace, type Scenario, type SavedSweep } from './workspace'

const USD = 2

function component(name: string, amount: string, paidByCounterparty?: boolean): AmountComponent {
  return { id: name, name, amount, paidByCounterparty }
}

function withComponents(group: 'additions' | 'deductions', components: AmountComponent[]): AmountSet {
  const set = amounts('1000000', '800000')
  return { ...set, [group]: { ...set[group], mode: 'components', components } }
}

describe('newAmountSet', () => {
  it('takes the lowest unused number, and starts invalid at zero (§4.7)', () => {
    const existing = [
      { ...amounts('1', '1'), name: 'Amount set 1' },
      { ...amounts('1', '1'), name: 'Amount set 3' },
    ]
    const set = newAmountSet(existing)
    expect(set.name).toBe('Amount set 2')
    expect(set.additions).toEqual({ mode: 'total', total: '0', components: [] })
    expect(set.deductions).toEqual({ mode: 'total', total: '0', components: [] })
    expect(newAmountSet([]).name).toBe('Amount set 1')
  })
})

describe('newComponent', () => {
  it('names it after the lowest unused number', () => {
    expect(newComponent([component('Component 1', '1')])).toMatchObject({ name: 'Component 2', amount: '0' })
  })
})

describe('duplicateAmountSet', () => {
  it('gives the copy and its components new ids (§8.5)', () => {
    const set = withComponents('additions', [component('Premiums', '5', true)])
    const copy = duplicateAmountSet(set)
    expect(copy.name).toBe('Amounts (copy)')
    expect(copy.id).not.toBe(set.id)
    expect(copy.additions.components).toEqual([
      { ...set.additions.components[0], id: expect.not.stringMatching('Premiums') },
    ])
    expect(set.additions.components[0].id).toBe('Premiums')
  })
})

describe('deleting an amount set (§8.6)', () => {
  const scenario = (id: string, amountSetId: string) => ({ id, amountSetId }) as Scenario
  const sweep = (id: string, baselineAmountSetId: string) => ({ id, baselineAmountSetId }) as SavedSweep
  const workspace = () => ({
    ...emptyWorkspace('en-US'),
    amountSets: [
      { ...amounts('1', '1'), id: 'a' },
      { ...amounts('1', '1'), id: 'b' },
    ],
    scenarios: [scenario('s1', 'a'), scenario('s2', 'b'), scenario('s3', 'a')],
    sweeps: [sweep('w1', 'a'), sweep('w2', 'b')],
  })

  it('lists the scenarios deleted with it and the sweeps left needing repair', () => {
    const impact = deleteImpact(workspace(), 'a')
    expect(impact.scenarios.map((s) => s.id)).toEqual(['s1', 's3'])
    expect(impact.sweeps.map((s) => s.id)).toEqual(['w1'])
  })

  it('deletes its scenarios and keeps its sweeps', () => {
    const w = workspace()
    deleteAmountSet(w, 'a')
    expect(w.amountSets.map((s) => s.id)).toEqual(['b'])
    expect(w.scenarios.map((s) => s.id)).toEqual(['s2'])
    expect(w.sweeps).toHaveLength(2)
  })
})

describe('switchGroupMode (§4.3)', () => {
  it('totals the components, keeping them inactive', () => {
    const set = withComponents('deductions', [component('Claims', '900000'), component('Rebates', '-12500.5')])
    const next = switchGroupMode(set, 'deductions', 'total', USD)
    expect(next.deductions).toEqual({ ...set.deductions, mode: 'total', total: '887499.50' })
  })

  it('keeps the old total when a component is unreadable', () => {
    const set = withComponents('deductions', [component('Claims', 'abc')])
    expect(switchGroupMode(set, 'deductions', 'total', USD).deductions.total).toBe('800000')
  })

  it('totals the components marked as paid by the counterparty (§4.6)', () => {
    const set = withComponents('additions', [component('Premiums', '800000', true), component('Other', '200000')])
    expect(switchGroupMode(set, 'additions', 'total', USD).additions).toMatchObject({
      mode: 'total',
      total: '1000000.00',
      paidByCounterparty: '800000.00',
    })
  })

  it('leaves the counterparty-paid amount blank when nothing is marked', () => {
    const set = withComponents('additions', [component('Other', '200000')])
    set.additions.paidByCounterparty = '5'
    expect(switchGroupMode(set, 'additions', 'total', USD).additions.paidByCounterparty).toBeUndefined()
  })

  it('restores kept components unchanged', () => {
    const set = withComponents('deductions', [component('Claims', '900000')])
    const back = switchGroupMode(switchGroupMode(set, 'deductions', 'total', USD), 'deductions', 'components', USD)
    expect(back.deductions.components).toEqual(set.deductions.components)
  })

  it('starts components with one equal to the total', () => {
    const next = switchGroupMode(amounts('1000000', '800500.25'), 'deductions', 'components', USD)
    expect(next.deductions.mode).toBe('components')
    expect(next.deductions.components).toMatchObject([{ name: 'Component 1', amount: '800500.25' }])
  })

  it('starts with a blank component when the total is unreadable', () => {
    const next = switchGroupMode(amounts('1000000', '1.234'), 'deductions', 'components', USD)
    expect(next.deductions.components).toMatchObject([{ name: 'Component 1', amount: '' }])
  })

  it('splits additions to keep the counterparty-paid amount', () => {
    const next = switchGroupMode(amounts('1000000', '0', '250000.50'), 'additions', 'components', USD)
    expect(next.additions.components).toMatchObject([
      { name: 'Paid by counterparty', amount: '250000.50', paidByCounterparty: true },
      { name: 'Other additions', amount: '749999.50' },
    ])
  })

  it('marks the one component when the counterparty paid all of it', () => {
    const next = switchGroupMode(amounts('1000', '0', '1000'), 'additions', 'components', USD)
    expect(next.additions.components).toMatchObject([
      { name: 'Paid by counterparty', amount: '1000', paidByCounterparty: true },
    ])
  })

  it.each([
    ['blank', undefined],
    ['zero', '0'],
    ['more than the total', '2000'],
    ['unreadable', 'x'],
  ])('ignores a counterparty-paid amount that is %s', (_, paid) => {
    const next = switchGroupMode(amounts('1000', '0', paid), 'additions', 'components', USD)
    expect(next.additions.components).toMatchObject([{ name: 'Component 1', amount: '1000' }])
  })
})
