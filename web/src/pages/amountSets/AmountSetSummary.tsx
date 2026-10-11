import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useId, type ReactNode } from 'react'
import type Big from 'big.js'
import { unroundedCR, type AmountResult, type AmountSet, type Issue } from '../../calc'
import { AccountingAmount } from '../../components/AccountingAmount'
import { truncated } from '../../components/truncated'
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
      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 1, columnGap: 3, m: 0 }}>
        {amounts.map(([term, value]) => (
          <SummaryRow key={term} term={term}>
            <AccountingAmount value={value} />
          </SummaryRow>
        ))}
        <SummaryRow term="Cost ratio">{`${unroundedPct(cr, f)} (before rounding)`}</SummaryRow>
      </Box>
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

function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <Typography component="dt" title={term} sx={{ ...truncated, maxWidth: 240 }}>
        {term}
      </Typography>
      <Typography component="dd" sx={{ m: 0, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </Typography>
    </>
  )
}
