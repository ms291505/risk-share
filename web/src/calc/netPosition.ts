import type Big from 'big.js'
import type { AmountTotals, Hint, NetPositions } from './types'

/**
 * §7.3. `signed` is the signed settlement: positive when the risk-bearer pays
 * the counterparty, negative when the counterparty pays the risk-bearer.
 */
export function netPositions(totals: AmountTotals, signed: Big): NetPositions {
  const hints: Hint[] = totals.counterpartyPaid.eq(0) ? ['noCounterpartyPaidAdditions'] : []
  return {
    // additions − deductions − settlement paid + settlement received
    riskBearer: totals.gainLoss.minus(signed),
    // −(additions paid by counterparty) + settlement received − settlement paid
    counterparty: totals.counterpartyPaid.neg().plus(signed),
    hints,
  }
}
