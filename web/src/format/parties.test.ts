import { describe, expect, it } from 'vitest'
import { partyName } from './parties'

describe('partyName (§3.2)', () => {
  it('uses the name, or the role while the name is blank', () => {
    expect(partyName({ riskBearer: 'Lisa', counterparty: ' Bob ' }, 'counterparty')).toBe('Bob')
    expect(partyName({ riskBearer: ' ', counterparty: 'Bob' }, 'riskBearer')).toBe('Risk-bearer')
  })
})
