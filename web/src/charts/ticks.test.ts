import { describe, expect, it } from 'vitest'
import { niceTicks } from './ticks'

describe('niceTicks', () => {
  it('uses round steps for a CR range', () => {
    expect(niceTicks(70, 100)).toEqual({ ticks: [70, 75, 80, 85, 90, 95, 100], decimals: 0 })
  })

  it('stays bounded for huge ranges', () => {
    // E.g. a currency curve across hundreds of millions.
    const { ticks } = niceTicks(-250_000_000, 730_000_000)
    expect(ticks.length).toBeLessThanOrEqual(12)
  })

  it('adds decimals for narrow ranges', () => {
    expect(niceTicks(84.9, 85.3)).toEqual({ ticks: [84.9, 84.95, 85, 85.05, 85.1, 85.15, 85.2, 85.25, 85.3], decimals: 2 })
  })

  it('handles currency ranges around zero', () => {
    expect(niceTicks(-125000, 175000).ticks).toEqual([-100000, -50000, 0, 50000, 100000, 150000])
  })
})
