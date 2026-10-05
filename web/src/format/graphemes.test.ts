import { afterEach, describe, expect, it, vi } from 'vitest'
import { graphemes } from './graphemes'

/** Intl as in a browser without Intl.Segmenter. */
const intlWithoutSegmenter = () => Object.assign(Object.create(Intl), { Segmenter: undefined })

describe('graphemes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('counts combined emoji and accents as one character each', () => {
    expect(graphemes('a👨‍👩‍👧👍🏽🇺🇸é')).toEqual(['a', '👨‍👩‍👧', '👍🏽', '🇺🇸', 'é'])
  })

  it('loads and falls back to code points without Intl.Segmenter (§1.6)', async () => {
    vi.stubGlobal('Intl', intlWithoutSegmenter())
    vi.resetModules()
    const fresh = await import('./graphemes')
    expect(fresh.graphemes('a😀🇺🇸')).toEqual(['a', '😀', '🇺', '🇸'])
  })
})
