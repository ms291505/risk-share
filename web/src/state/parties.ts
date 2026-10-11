import type { Issue, Parties } from '../calc'
import { PARTY_ROLES } from '../format/parties'
import { nameIssues, sameName } from './names'

/**
 * §3.3: names follow the shared name rules and differ from each other ignoring
 * case, so "who pays whom" is never ambiguous. Each issue's path is the role.
 */
export function partyNameIssues(parties: Parties): Issue[] {
  const issues = PARTY_ROLES.flatMap((role) => nameIssues(parties[role], [role]))
  if (issues.length === 0 && sameName(parties.riskBearer, parties.counterparty)) {
    issues.push({ code: 'partyNamesSame', path: ['counterparty'] })
  }
  return issues
}
