import type { Issue, Parties, PartyRole } from '../calc'
import { nameIssues, sameName } from './names'

const ROLES: PartyRole[] = ['riskBearer', 'counterparty']

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
