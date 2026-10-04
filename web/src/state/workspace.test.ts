import { describe, expect, it } from 'vitest'
import { compareCreated, nextCreatedAt } from './workspace'

describe('scenario creation order (§8.7)', () => {
  const now = new Date('2026-10-04T12:00:00.000Z')

  it('uses the current time when it is later than every scenario', () => {
    expect(nextCreatedAt([{ createdAt: '2026-10-01T00:00:00.000Z' }], now)).toBe('2026-10-04T12:00:00.000Z')
  })

  it('stays strictly increasing for scenarios created in the same millisecond', () => {
    const scenarios: { createdAt: string }[] = []
    for (let i = 0; i < 3; i++) scenarios.push({ createdAt: nextCreatedAt(scenarios, now) })
    expect(scenarios.map((s) => s.createdAt)).toEqual([
      '2026-10-04T12:00:00.000Z',
      '2026-10-04T12:00:00.001Z',
      '2026-10-04T12:00:00.002Z',
    ])
  })

  it('sorts by creation time, then id', () => {
    const t = '2026-10-04T12:00:00.000Z'
    const list = [
      { id: 'b', createdAt: t },
      { id: 'c', createdAt: '2026-10-03T12:00:00.000Z' },
      { id: 'a', createdAt: t },
    ]
    expect(list.sort(compareCreated).map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })
})
