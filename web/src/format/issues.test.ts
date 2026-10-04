import { describe, expect, it } from 'vitest'
import { issueMessage, issueMessages } from './issues'

describe('issueMessage', () => {
  it('fills in params', () => {
    expect(issueMessage({ code: 'tooManyDecimals', path: [], params: { max: 2 } })).toBe('Use at most 2 decimal places.')
  })

  it('dedupes repeated messages', () => {
    const shareIssue = { code: 'shareOutOfRange' as const, path: [] }
    expect(issueMessages([shareIssue, shareIssue])).toEqual(['Share must be between 0% and 100%.'])
  })
})
