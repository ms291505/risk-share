import { describe, expect, it } from 'vitest'
import { blankTerms, templateTerms } from './templates'
import { validateTerms } from './validateTerms'

describe('templates (§6.7)', () => {
  it('starter templates are valid', () => {
    for (const kind of ['gainShare', 'lossShare', 'fullRiskShare'] as const) {
      expect(validateTerms(templateTerms(kind), 2)).toEqual([])
    }
  })

  it('blank terms use default tier names and are invalid until filled in', () => {
    const t = blankTerms('full', 'currency')
    expect([t.gain!.tiers[0].name, t.loss!.tiers[0].name]).toEqual(['Gain share threshold', 'Loss share threshold'])
    expect(validateTerms(blankTerms('full', 'costRatio'), 2).length).toBeGreaterThan(0)
  })
})
