import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { truncated } from '../../components/truncated'
import { visuallyHidden } from '../../components/visuallyHidden'
import type { ComponentsLayoutProps } from './ComponentsEditor'
import { GROUP_LABELS } from './labels'

/** Text fields and 40px controls share a row: top-aligned, so an error under a field doesn't move them. */
const FIELD_CELL = { verticalAlign: 'top', minWidth: 180 } as const
const CONTROL_CELL = { verticalAlign: 'top', px: 1 } as const
/** Lines a total up with the amounts above it, past the input's own padding. */
const AMOUNT_TOTAL_CELL = { pr: '30px', fontVariantNumeric: 'tabular-nums' } as const

/** Components as table rows, with the totals in the footer. */
export function ComponentsTable({ groupKey, paidBy, rows, addButton, totals }: ComponentsLayoutProps) {
  const columns = paidBy ? 4 : 3
  // Kept short, so a long counterparty name doesn't widen the table. The full name is in the
  // title, the checkbox labels and the summary.
  const label = (text: string) =>
    text === paidBy ? (
      <Box component="span" title={text} sx={{ ...truncated, maxWidth: 120 }}>
        {text}
      </Box>
    ) : (
      text
    )

  // Positioned, so the visually hidden header stays inside the box.
  return (
    <Box sx={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <Table size="small" aria-label={`${GROUP_LABELS[groupKey]} components`}>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Amount</TableCell>
            {paidBy && <TableCell align="center">{label(paidBy)}</TableCell>}
            <TableCell>
              <Box component="span" sx={visuallyHidden}>
                Remove
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell sx={FIELD_CELL}>{row.name}</TableCell>
              <TableCell sx={FIELD_CELL}>{row.amount}</TableCell>
              {paidBy && (
                <TableCell align="center" sx={CONTROL_CELL}>
                  {row.paid}
                </TableCell>
              )}
              <TableCell align="center" sx={CONTROL_CELL}>
                {row.remove}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={columns} sx={{ py: 0.5 }}>
              {addButton}
            </TableCell>
          </TableRow>
        </TableBody>
        <TableFooter sx={{ '& td, & th': { color: 'text.primary', fontSize: 'body1.fontSize', fontWeight: 500 } }}>
          {totals.map(({ term, value }) => (
            <TableRow key={term}>
              <TableCell component="th" scope="row">
                {label(term)}
              </TableCell>
              <TableCell align="right" sx={AMOUNT_TOTAL_CELL}>
                {value}
              </TableCell>
              <TableCell colSpan={columns - 2} />
            </TableRow>
          ))}
        </TableFooter>
      </Table>
    </Box>
  )
}
