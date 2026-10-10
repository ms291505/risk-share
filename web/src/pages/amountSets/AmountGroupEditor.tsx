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
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { Draft } from 'immer'
import { useId } from 'react'
import { flushSync } from 'react-dom'
import { minorUnits, type AmountComponent, type AmountGroup, type AmountSet, type Issue } from '../../calc'
import { CommitTextField } from '../../components/CommitTextField'
import { NumberField } from '../../components/NumberField'
import { visuallyHidden } from '../../components/visuallyHidden'
import { issueMessage } from '../../format/issues'
import { newComponent, switchGroupMode, type GroupKey, type GroupMode } from '../../state/amountSets'
import { nameIssues, normalizeName } from '../../state/names'
import { useWorkspaceStore } from '../../state/store'
import { focusById, focusIds } from './focus'
import { componentLabel, GROUP_LABELS, messageAt } from './labels'
import { updateAmountSet } from './updateAmountSet'

interface Props {
  set: AmountSet
  groupKey: GroupKey
  /** From evaluating the set; shown on the fields they're about. */
  issues: Issue[]
}

/** Additions or deductions, entered as a total or as components (§4.3). */
export function AmountGroupEditor({ set, groupKey, issues }: Props) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const currency = useWorkspaceStore((s) => s.workspace.settings.currency)
  const headingId = useId()
  const errorId = useId()
  const group = set[groupKey]
  const label = GROUP_LABELS[groupKey]
  // Components mode has no counterparty-paid field, so its range error goes on the section.
  const sectionError =
    messageAt(issues, groupKey) ??
    (group.mode === 'components' ? messageAt(issues, groupKey, 'paidByCounterparty') : null)

  const switchMode = (mode: GroupMode) => {
    const undoLabel = `Switch ${label.toLowerCase()} to ${mode === 'total' ? 'a total' : 'components'}`
    updateAmountSet(set.id, undoLabel, () => switchGroupMode(set, groupKey, mode, minorUnits(currency)))
  }

  return (
    <Stack
      component="section"
      spacing={2}
      aria-labelledby={headingId}
      aria-describedby={sectionError ? errorId : undefined}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography id={headingId} variant="h6" component="h2">
          {label}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={group.mode}
          disabled={readOnly}
          aria-label={`Enter ${label.toLowerCase()} as`}
          onChange={(_, mode: GroupMode | null) => mode && switchMode(mode)}
        >
          <ToggleButton value="total">Total</ToggleButton>
          <ToggleButton value="components">Components</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {sectionError && (
        <Typography id={errorId} variant="body2" color="error">
          {sectionError}
        </Typography>
      )}
      {group.mode === 'total' ? (
        <TotalFields set={set} groupKey={groupKey} issues={issues} />
      ) : (
        <ComponentsTable set={set} groupKey={groupKey} issues={issues} />
      )}
    </Stack>
  )
}

/** Edits the group in an undoable step. */
function editGroup(set: AmountSet, groupKey: GroupKey, label: string, recipe: (group: Draft<AmountGroup>) => void) {
  updateAmountSet(set.id, label, (s) => recipe(s[groupKey]))
}

function TotalFields({ set, groupKey, issues }: Props) {
  const isAdditions = groupKey === 'additions'
  const label = `Total ${GROUP_LABELS[groupKey].toLowerCase()}`
  return (
    <Stack spacing={2} sx={{ maxWidth: 360 }}>
      <NumberField
        kind="currency"
        label={label}
        value={set[groupKey].total}
        // Total additions must be positive (§4.5).
        allowNegative={!isAdditions}
        error={messageAt(issues, groupKey, 'total')}
        onCommit={(total) =>
          editGroup(set, groupKey, `Edit ${label.toLowerCase()}`, (g) => {
            g.total = total
          })
        }
      />
      {isAdditions && (
        <NumberField
          kind="currency"
          label="Paid by counterparty (optional)"
          value={set.additions.paidByCounterparty ?? ''}
          error={messageAt(issues, 'additions', 'paidByCounterparty')}
          onCommit={(paid) =>
            updateAmountSet(set.id, 'Edit counterparty-paid amount', (s) => {
              s.additions.paidByCounterparty = paid
            })
          }
        />
      )}
    </Stack>
  )
}

function ComponentsTable({ set, groupKey, issues }: Props) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const isAdditions = groupKey === 'additions'
  const { components } = set[groupKey]
  const groupLabel = GROUP_LABELS[groupKey]

  const add = () => {
    const component = newComponent(components)
    flushSync(() =>
      editGroup(set, groupKey, 'Add component', (g) => {
        g.components.push(component)
      }),
    )
    focusById(focusIds.componentName(component.id))
  }

  const remove = (id: string) => {
    const next = components[components.findIndex((c) => c.id === id) + 1]
    flushSync(() =>
      editGroup(set, groupKey, 'Remove component', (g) => {
        g.components = g.components.filter((c) => c.id !== id)
      }),
    )
    focusById(next ? focusIds.removeComponent(next.id) : focusIds.addComponent(groupKey))
  }

  const editComponent = (id: string, label: string, recipe: (c: Draft<AmountComponent>) => void) =>
    editGroup(set, groupKey, label, (g) => {
      const component = g.components.find((c) => c.id === id)
      if (component) recipe(component)
    })

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size="small" aria-label={`${groupLabel} components`}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Amount</TableCell>
              {isAdditions && <TableCell>Paid by counterparty</TableCell>}
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
              return (
                <TableRow key={c.id}>
                  <TableCell sx={{ verticalAlign: 'top', minWidth: 180 }}>
                    <CommitTextField
                      id={focusIds.componentName(c.id)}
                      size="small"
                      fullWidth
                      value={c.name}
                      error={nameIssue ? issueMessage(nameIssue) : null}
                      slotProps={{ htmlInput: { 'aria-label': `Name, component ${index + 1}` } }}
                      onCommit={(name) =>
                        editComponent(c.id, 'Rename component', (draft) => {
                          draft.name = normalizeName(name)
                        })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ verticalAlign: 'top', minWidth: 180 }}>
                    <NumberField
                      kind="currency"
                      size="small"
                      fullWidth
                      // Components may be negative, e.g. rebates (§4.4).
                      allowNegative
                      value={c.amount}
                      error={messageAt(issues, groupKey, 'components', c.id, 'amount')}
                      slotProps={{ htmlInput: { 'aria-label': `Amount, ${row}` } }}
                      onCommit={(amount) =>
                        editComponent(c.id, 'Edit component amount', (draft) => {
                          draft.amount = amount
                        })
                      }
                    />
                  </TableCell>
                  {isAdditions && (
                    <TableCell padding="checkbox" sx={{ verticalAlign: 'top' }}>
                      <Checkbox
                        checked={Boolean(c.paidByCounterparty)}
                        disabled={readOnly}
                        slotProps={{ input: { 'aria-label': `Paid by counterparty, ${row}` } }}
                        onChange={(e) => {
                          const paid = e.target.checked
                          editComponent(
                            c.id,
                            paid ? 'Mark as paid by counterparty' : 'Unmark as paid by counterparty',
                            (draft) => {
                              draft.paidByCounterparty = paid
                            },
                          )
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell padding="checkbox" sx={{ verticalAlign: 'top' }}>
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
        </Table>
      </Box>
      <Button id={focusIds.addComponent(groupKey)} startIcon={<AddOutlined />} disabled={readOnly} onClick={add}>
        Add component
      </Button>
    </Stack>
  )
}
