import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, type ReactNode } from 'react'
import type Big from 'big.js'
import { unroundedCR, type AmountResult, type AmountSet, type Issue } from '../../calc'
import { AccountingAmount } from '../../components/AccountingAmount'
import { unroundedPct } from '../../format/formatters'
import { useFormatters } from '../../format/useFormatters'
import { useIssueMessage } from '../../format/useIssueMessage'
import { useWorkspaceStore } from '../../state/store'
import { issueField, paidByLabel } from './labels'

/**
 * The set's totals and its cost ratio before rounding, which each set of
 * terms rounds its own way (§5). A status region, so changes are announced
 * without moving focus (§13.4).
 */
export function AmountSetSummary({ set, result }: { set: AmountSet; result: AmountResult }) {
  const f = useFormatters()
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const message = useIssueMessage()
  const headingId = useId()
  const describe = (issue: Issue) => {
    const field = issueField(set, issue)
    return field ? `${field}: ${message(issue)}` : message(issue)
  }
  let content
  if (result.ok) {
    const { additions, deductions, gainLoss, counterpartyPaid } = result.totals
    const cr = unroundedCR(additions, deductions)
    const amounts: [string, Big][] = [
      ['Total additions', additions],
      ['Total deductions', deductions],
      ['Gain (loss)', gainLoss],
      [paidByLabel(parties), counterpartyPaid],
    ]
    content = (
      <Stack component="dl" spacing={1} sx={{ m: 0 }}>
        {amounts.map(([term, value]) => (
          <SummaryRow key={term} term={term}>
            <AccountingAmount value={value} />
          </SummaryRow>
        ))}
        <SummaryRow term="Cost ratio">{`${unroundedPct(cr, f)} (before rounding)`}</SummaryRow>
      </Stack>
    )
  } else {
    content = (
      <>
        <Typography>Fix these to see the totals:</Typography>
        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          {[...new Set(result.issues.map(describe))].map((text) => (
            <Typography component="li" key={text}>
              {text}
            </Typography>
          ))}
        </Box>
      </>
    )
  }
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ maxWidth: 480 }}>
      <Typography id={headingId} variant="h6" component="h2" sx={{ mb: 1 }}>
        Summary
      </Typography>
      <Box role="status">{content}</Box>
    </Box>
  )
}

/**
 * A term and its value, right-aligned. Where both don't fit on one line, the
 * value moves under the term. The term wraps rather than being cut off: this
 * is the one place a long counterparty name is shown in full.
 */
function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3 }}>
      <Typography component="dt" sx={{ flex: '1 1 8em', minWidth: 0, overflowWrap: 'anywhere' }}>
        {term}
      </Typography>
      <Typography component="dd" sx={{ m: 0, ml: 'auto', textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </Typography>
    </Box>
  )
}
