import { describe, expect, it } from 'vitest'
import { side, terms } from './__fixtures__/builders'
import { intlSummaryFormat, summarizeTerms } from './summary'
import { templateTerms } from './templates'

const parties = { riskBearer: 'Lisa', counterparty: 'Bob' }
const usd = intlSummaryFormat('USD', 'en-US')
let n = 0
const id = () => `t${n++}`

describe('summarizeTerms (§6.5)', () => {
  it('matches the requirements example', () => {
    const t = terms('gain', { gain: side([['85.0', '100']], { maxPayout: '250000' }) })
    t.gain!.tiers[0].name = 'Gain share threshold'
    expect(summarizeTerms(t, parties, usd)).toEqual([
      'If the cost ratio is below 85.0%, Lisa pays Bob 100% of the difference × total additions, up to $250,000.',
      'Lisa absorbs all losses.',
    ])
  })

  it('describes templates', () => {
    expect(summarizeTerms(templateTerms('fullRiskShare', id), parties, usd)).toEqual([
      'If the cost ratio is below 99.0%, Lisa pays Bob 50% of the difference × total additions.',
      'If the cost ratio is above 101.0%, Bob pays Lisa 30% of the difference × total additions.',
      'Between 99.0% and 101.0%, no payment is made.',
    ])
  })

  it('describes tiers, minimums and both caps', () => {
    const t = terms('gain', {
      gain: side([['85.0', '50'], ['80.0', '80'], ['75.0', '0']], {
        maxPayout: '250000',
        maxPayoutPctOfAdditions: '5',
        minimum: { amount: '10000', behavior: 'deductible' },
      }),
    })
    expect(summarizeTerms(t, parties, usd)).toEqual([
      'If the cost ratio is below 85.0%, Lisa pays Bob a share of the difference × total additions: ' +
        '50% from 85.0% (Tier 1) down to 80.0%, 80% from 80.0% (Tier 2) down to 75.0%, and 0% below 75.0% (Tier 3), ' +
        'up to the lower of $250,000 and 5% of total additions.',
      '$10,000 is deducted from that amount (but not below zero).',
      'Lisa absorbs all losses.',
    ])
  })

  it('joins two tiers with "and"', () => {
    const t = terms('loss', { loss: side([['105.0', '50'], ['110.0', '80']]) })
    expect(summarizeTerms(t, parties, usd)[0]).toBe(
      'If the cost ratio is above 105.0%, Bob pays Lisa a share of the difference × total additions: ' +
        '50% from 105.0% (Tier 1) up to 110.0% and 80% above 110.0% (Tier 2).',
    )
  })

  it('describes currency terms', () => {
    const t = terms(
      'loss',
      { loss: side([['50000', '50']], { minimum: { amount: '5000', behavior: 'allOrNothing' } }) },
      { unit: 'currency' },
    )
    t.loss!.tiers[0].name = 'Loss share threshold'
    expect(summarizeTerms(t, parties, usd)).toEqual([
      'If the loss is above $50,000, Bob pays Lisa 50% of the loss above $50,000.',
      'If that amount is less than $5,000, nothing is paid.',
      'Lisa keeps all gains.',
    ])
  })

  it('describes the corridor for currency full risk share', () => {
    const t = terms('full', { gain: side([['100000', '50']]), loss: side([['50000', '30']]) }, { unit: 'currency' })
    expect(summarizeTerms(t, parties, usd).at(-1)).toBe(
      'Between a loss of $50,000 and a gain of $100,000, no payment is made.',
    )
  })

  it('shows unparsable values as typed', () => {
    const t = terms('gain', { gain: side([['85,0', '']]) })
    expect(summarizeTerms(t, parties, usd)[0]).toContain('below 85,0 (Tier 1)')
  })

  it('formats for the locale', () => {
    const t = templateTerms('gainShare', id)
    expect(summarizeTerms(t, parties, intlSummaryFormat('EUR', 'de-DE'))[0]).toMatch(/85,0\s%/)
  })
})
