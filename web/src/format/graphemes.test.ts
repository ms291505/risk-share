import { describe, expect, it } from 'vitest'
import { graphemes } from './graphemes'

describe('graphemes', () => {
  it('counts combined emoji and accents as one character each', () => {
    expect(graphemes('a👨‍👩‍👧👍🏽🇺🇸é')).toEqual(['a', '👨‍👩‍👧', '👍🏽', '🇺🇸', 'é'])
  })
})
