import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import type { Draft } from 'immer'
import { flushSync } from 'react-dom'
import { D, minorUnits, type AmountComponent, type AmountSet, type DecimalString, type Issue } from '../../calc'
import { CommitTextField } from '../../components/CommitTextField'
import { NumberField } from '../../components/NumberField'
import { visuallyHidden } from '../../components/visuallyHidden'
import { useFormatters } from '../../format/useFormatters'
import { useIssueMessage } from '../../format/useIssueMessage'
import { componentTotals, newComponent, type GroupKey } from '../../state/amountSets'
import { nameIssues, normalizeName } from '../../state/names'
import { partyName } from '../../state/parties'
import { useWorkspaceStore } from '../../state/store'
import { focusById, focusIds } from './focus'
import { componentLabel, GROUP_LABELS, issueAt, paidByLabel } from './labels'
import { updateGroup } from './updateAmountSet'

/** Text fields and 40px controls share a row: top-aligned, so an error under a field doesn't move them. */
const FIELD_CELL = { verticalAlign: 'top' } as const
const CONTROL_CELL = { verticalAlign: 'top', px: 1 } as const
/** Lines a total up with the amounts above it, past the input's own padding. */
const AMOUNT_TOTAL_CELL = { pr: '30px', fontVariantNumeric: 'tabular-nums' } as const

interface Props {
  set: AmountSet
  groupKey: GroupKey
  /** From evaluating the set; shown on the fields they're about. */
  issues: Issue[]
}

/** Named components that sum to the group's total (§4.3), shown below them. */
export function ComponentsTable({ set, groupKey, issues }: Props) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const currency = useWorkspaceStore((s) => s.workspace.settings.currency)
  const f = useFormatters()
  const message = useIssueMessage()
  const isAdditions = groupKey === 'additions'
  const { components } = set[groupKey]
  const groupLabel = GROUP_LABELS[groupKey]
  const paidBy = paidByLabel(parties)
  const totals = componentTotals(set[groupKey], minorUnits(currency))
  const formatTotal = (x: DecimalString | null) => (x === null ? '—' : f.currency(D(x)))

  const edit = (id: string, label: string, recipe: (component: Draft<AmountComponent>) => void) =>
    updateGroup(set.id, groupKey, label, (g) => {
      const component = g.components.find((c) => c.id === id)
      if (component) recipe(component)
    })

  const add = () => {
    const component = newComponent(components)
    flushSync(() =>
      updateGroup(set.id, groupKey, 'Add component', (g) => {
        g.components.push(component)
      }),
    )
    focusById(focusIds.componentName(component.id))
  }

  const remove = (id: string) => {
    const next = components[components.findIndex((c) => c.id === id) + 1]
    flushSync(() =>
      updateGroup(set.id, groupKey, 'Remove component', (g) => {
        g.components = g.components.filter((c) => c.id !== id)
      }),
    )
    focusById(next ? focusIds.removeComponent(next.id) : focusIds.addComponent(groupKey))
  }

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size="small" aria-label={`${groupLabel} components`}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Amount</TableCell>
              {isAdditions && <TableCell align="center">{paidBy}</TableCell>}
              <TableCell>
                <Box component="span" sx={visuallyHidden}>
                  Remove
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {components.map((c, index) => {
              const row = componentLabel(c, index)
              const nameIssue = nameIssues(c.name, [])[0]
              const amountIssue = issueAt(issues, groupKey, 'components', c.id, 'amount')
              return (
                <TableRow key={c.id}>
                  <TableCell sx={{ ...FIELD_CELL, minWidth: 180 }}>
                    <CommitTextField
                      id={focusIds.componentName(c.id)}
                      size="small"
                      fullWidth
                      value={c.name}
                      error={nameIssue ? message(nameIssue) : null}
                      slotProps={{ htmlInput: { 'aria-label': `Name, component ${index + 1}` } }}
                      onCommit={(name) =>
                        edit(c.id, 'Rename component', (draft) => {
                          draft.name = normalizeName(name)
                        })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ ...FIELD_CELL, minWidth: 180 }}>
                    <NumberField
                      kind="currency"
                      size="small"
                      fullWidth
                      // Components may be negative, e.g. rebates (§4.4).
                      allowNegative
                      value={c.amount}
                      error={amountIssue ? message(amountIssue) : null}
                      slotProps={{ htmlInput: { 'aria-label': `Amount, ${row}` } }}
                      onCommit={(amount) =>
                        edit(c.id, 'Edit component amount', (draft) => {
                          draft.amount = amount
                        })
                      }
                    />
                  </TableCell>
                  {isAdditions && (
                    <TableCell align="center" sx={CONTROL_CELL}>
                      <Checkbox
                        checked={Boolean(c.paidByCounterparty)}
                        disabled={readOnly}
                        sx={{ p: 1 }}
                        slotProps={{ input: { 'aria-label': `${paidBy}, ${row}` } }}
                        onChange={(e) => {
                          const paid = e.target.checked
                          const label = `${paid ? 'Mark' : 'Unmark'} as paid by ${partyName(parties, 'counterparty')}`
                          edit(c.id, label, (draft) => {
                            draft.paidByCounterparty = paid
                          })
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell align="center" sx={CONTROL_CELL}>
                    <IconButton
                      id={focusIds.removeComponent(c.id)}
                      aria-label={`Remove ${row}`}
                      disabled={readOnly}
                      onClick={() => remove(c.id)}
                    >
                      <DeleteOutlined />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter sx={{ '& td, & th': { color: 'text.primary', fontSize: 'body1.fontSize', fontWeight: 500 } }}>
            <TableRow>
              <TableCell component="th" scope="row">
                Total {groupLabel.toLowerCase()}
              </TableCell>
              <TableCell align="right" sx={AMOUNT_TOTAL_CELL}>
                {formatTotal(totals.total)}
              </TableCell>
              <TableCell colSpan={isAdditions ? 2 : 1} />
            </TableRow>
            {isAdditions && (
              <TableRow>
                <TableCell component="th" scope="row">
                  {paidBy}
                </TableCell>
                <TableCell align="right" sx={AMOUNT_TOTAL_CELL}>
                  {formatTotal(totals.paid)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
          </TableFooter>
        </Table>
      </Box>
      <Button id={focusIds.addComponent(groupKey)} startIcon={<AddOutlined />} disabled={readOnly} onClick={add}>
        Add component
      </Button>
    </Stack>
  )
}
