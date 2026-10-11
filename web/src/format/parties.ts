import type { Parties, PartyRole } from '../calc'

export const PARTY_ROLES: PartyRole[] = ['riskBearer', 'counterparty']

export const ROLE_LABELS: Record<PartyRole, string> = { riskBearer: 'Risk-bearer', counterparty: 'Counterparty' }

/**
 * How text refers to a party: by its name (§3.2), e.g. "Paid by Bob". The
 * role stands in only while the name is blank, which the Workspace view
 * flags as an error.
 */
export function partyName(parties: Parties, role: PartyRole): string {
  return parties[role].trim() || ROLE_LABELS[role]
}
