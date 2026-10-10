import { describe, expect, it } from 'vitest'
import type { AmountComponent, AmountSet } from '../calc'
import { amounts } from '../calc/__fixtures__/builders'
import {
  deleteAmountSet,
  deleteImpact,
  duplicateAmountSet,
  newAmountSet,
  newComponent,
  replaceComponentsWithTotal,
  splitIntoComponents,
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

describe('splitIntoComponents (§4.3)', () => {
  const split = (set: AmountSet, key: 'additions' | 'deductions') => splitIntoComponents(set, key, USD)[key]

  it('starts with one component equal to the total', () => {
    const deductions = split(amounts('1000000', '800500.25'), 'deductions')
    expect(deductions.mode).toBe('components')
    expect(deductions.components).toMatchObject([{ name: 'Component 1', amount: '800500.25' }])
  })

  it('starts with a blank component when the total is unreadable', () => {
    expect(split(amounts('1000000', '1.234'), 'deductions').components).toMatchObject([
      { name: 'Component 1', amount: '' },
    ])
  })

  it('replaces components stored alongside the total', () => {
    const set = amounts('1000', '50')
    set.deductions.components = [component('Old', '1')]
    expect(split(set, 'deductions').components).toMatchObject([{ name: 'Component 1', amount: '50' }])
  })
})

describe('replaceComponentsWithTotal (§4.3)', () => {
  it('removes the components and totals them', () => {
    const set = withComponents('deductions', [component('Claims', '900000'), component('Rebates', '-12500.5')])
    expect(replaceComponentsWithTotal(set, 'deductions', USD).deductions).toEqual({
      mode: 'total',
      total: '887499.50',
      components: [],
    })
  })

  it('leaves the total blank when an amount is unreadable', () => {
    const set = withComponents('deductions', [component('Claims', 'abc')])
    expect(replaceComponentsWithTotal(set, 'deductions', USD).deductions.total).toBe('')
  })

  it('drops what the marked components recorded as paid by the counterparty (§4.6)', () => {
    const set = withComponents('additions', [component('Premiums', '800000', true), component('Other', '200000')])
    expect(replaceComponentsWithTotal(set, 'additions', USD).additions).toEqual({
      mode: 'total',
      total: '1000000.00',
      components: [],
    })
  })
})
