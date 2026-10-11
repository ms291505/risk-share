import { describe, expect, it } from 'vitest'
import { issueMessage, issueMessages } from './issues'

const parties = { riskBearer: 'Lisa', counterparty: 'Bob' }

describe('issueMessage', () => {
  it('fills in params', () => {
    expect(issueMessage({ code: 'tooManyDecimals', path: [], params: { max: 2 } }, parties)).toBe(
      'Use at most 2 decimal places.',
    )
  })

  it('names the parties (§3.2)', () => {
    expect(issueMessage({ code: 'counterpartyPaidOutOfRange', path: [] }, parties)).toBe(
      'The amount paid by Bob must be between zero and total additions.',
    )
  })

  it('dedupes repeated messages', () => {
    const shareIssue = { code: 'shareOutOfRange' as const, path: [] }
    expect(issueMessages([shareIssue, shareIssue], parties)).toEqual(['Share must be between 0% and 100%.'])
  })
})
