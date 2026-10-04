import type { Parties, PartyRole } from '../calc'

export const MAX_PARTY_NAME_LENGTH = 80

export type PartyNameIssue = 'empty' | 'tooLong' | 'sameAsOther'

/** Party names are trimmed before they're stored (§3.3). */
export function normalizePartyName(name: string): string {
  return name.trim()
}

/**
 * §3.3: names are non-empty, at most 80 characters, and different from each
 * other ignoring case, so "who pays whom" is never ambiguous.
 */
export function partyNameIssues(parties: Parties): Partial<Record<PartyRole, PartyNameIssue>> {
  const issues: Partial<Record<PartyRole, PartyNameIssue>> = {}
  const roles: PartyRole[] = ['riskBearer', 'counterparty']
  for (const role of roles) {
    const name = normalizePartyName(parties[role])
    if (name === '') issues[role] = 'empty'
    else if (name.length > MAX_PARTY_NAME_LENGTH) issues[role] = 'tooLong'
  }
  const same =
    normalizePartyName(parties.riskBearer).toLocaleLowerCase() ===
    normalizePartyName(parties.counterparty).toLocaleLowerCase()
  if (same && !issues.riskBearer && !issues.counterparty) issues.counterparty = 'sameAsOther'
  return issues
}
