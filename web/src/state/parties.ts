import type { Issue, Parties, PartyRole } from '../calc'
import { nameIssues, normalizeName, sameName } from './names'

const ROLES: PartyRole[] = ['riskBearer', 'counterparty']

export const ROLE_LABELS: Record<PartyRole, string> = { riskBearer: 'Risk-bearer', counterparty: 'Counterparty' }

/**
 * How text refers to a party: by its name (§3.2), e.g. "Paid by Bob". The
 * role stands in only while the name is blank, which the Workspace view
 * flags as an error.
 */
export function partyName(parties: Parties, role: PartyRole): string {
  return normalizeName(parties[role]) || ROLE_LABELS[role]
}

/**
 * §3.3: names follow the shared name rules and differ from each other ignoring
 * case, so "who pays whom" is never ambiguous. Each issue's path is the role.
 */
export function partyNameIssues(parties: Parties): Issue[] {
  const issues = ROLES.flatMap((role) => nameIssues(parties[role], [role]))
  if (issues.length === 0 && sameName(parties.riskBearer, parties.counterparty)) {
    issues.push({ code: 'partyNamesSame', path: ['counterparty'] })
  }
  return issues
}
