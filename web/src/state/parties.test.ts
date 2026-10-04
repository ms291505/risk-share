import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH } from './names'
import { partyNameIssues } from './parties'

describe('partyNameIssues (§3.3)', () => {
  it('accepts distinct names', () => {
    expect(partyNameIssues({ riskBearer: 'Lisa', counterparty: 'Bob' })).toEqual([])
  })

  it('rejects empty and overlong names', () => {
    expect(
      partyNameIssues({ riskBearer: '  ', counterparty: 'x'.repeat(MAX_NAME_LENGTH + 1) }).map((i) => [
        i.code,
        i.path,
      ]),
    ).toEqual([
      ['nameEmpty', ['riskBearer']],
      ['nameTooLong', ['counterparty']],
    ])
  })

  it('rejects names that differ only by case or surrounding spaces', () => {
    expect(partyNameIssues({ riskBearer: 'Lisa', counterparty: ' lisa ' })).toEqual([
      { code: 'partyNamesSame', path: ['counterparty'] },
    ])
  })
})
