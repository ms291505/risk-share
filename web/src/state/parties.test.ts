import { describe, expect, it } from 'vitest'
import { MAX_PARTY_NAME_LENGTH, partyNameIssues } from './parties'

describe('partyNameIssues (§3.3)', () => {
  it('accepts distinct names', () => {
    expect(partyNameIssues({ riskBearer: 'Lisa', counterparty: 'Bob' })).toEqual({})
  })

  it('rejects empty and overlong names', () => {
    expect(partyNameIssues({ riskBearer: '  ', counterparty: 'x'.repeat(MAX_PARTY_NAME_LENGTH + 1) })).toEqual({
      riskBearer: 'empty',
      counterparty: 'tooLong',
    })
  })

  it('rejects names that differ only by case or surrounding spaces', () => {
    expect(partyNameIssues({ riskBearer: 'Lisa', counterparty: ' lisa ' })).toEqual({ counterparty: 'sameAsOther' })
  })
})
