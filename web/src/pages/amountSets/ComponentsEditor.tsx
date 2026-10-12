import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import type { Draft } from 'immer'
import type { ReactElement, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { D, minorUnits, type AmountComponent, type AmountSet, type DecimalString, type Issue } from '../../calc'
import { AccountingAmount } from '../../components/AccountingAmount'
import { CommitTextField } from '../../components/CommitTextField'
import { NumberField } from '../../components/NumberField'
import { useElementWidth } from '../../components/useElementWidth'
import { partyName } from '../../format/parties'
import { useIssueMessage } from '../../format/useIssueMessage'
import { componentTotals, newComponent, type GroupKey } from '../../state/amountSets'
import { nameIssues, normalizeName } from '../../state/names'
import { useWorkspaceStore } from '../../state/store'
import { ComponentsStack } from './ComponentsStack'
import { ComponentsTable } from './ComponentsTable'
import { focusById, focusIds } from './focus'
import { componentLabel, GROUP_LABELS, issueAt, paidByLabel } from './labels'
import { updateGroup } from './updateAmountSet'

/** The narrowest the table can be with every column visible; below it, components are stacked. */
const MIN_TABLE_WIDTH = 600

/** One component's controls, placed by a layout. */
export interface ComponentControls {
  id: string
  name: ReactNode
  amount: ReactNode
  /** The "Paid by ‹counterparty›" checkbox, for additions. */
  paid: ReactElement | null
  remove: ReactNode
}

export interface ComponentsLayoutProps {
  groupKey: GroupKey
  /** "Paid by ‹counterparty›", for additions. */
  paidBy: string | null
  rows: ComponentControls[]
  addButton: ReactNode
  totals: { term: string; value: ReactNode }[]
}

interface Props {
  set: AmountSet
  groupKey: GroupKey
  /** From evaluating the set; shown on the fields they're about. */
  issues: Issue[]
}

/**
 * Named components that sum to the group's total (§4.3), with the total below
 * them. A table where there's room, otherwise one block per component, so
 * amounts are never cut off.
 */
export function ComponentsEditor({ set, groupKey, issues }: Props) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const currency = useWorkspaceStore((s) => s.workspace.settings.currency)
  const message = useIssueMessage()
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const stacked = width !== null && width < MIN_TABLE_WIDTH
  const { components } = set[groupKey]
  const paidBy = groupKey === 'additions' ? paidByLabel(parties) : null

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

  // The stacked layout shows labels; the table's column headers do that job there.
  const rows = components.map((c, index): ComponentControls => {
    const row = componentLabel(c, index)
    const nameIssue = nameIssues(c.name, [])[0]
    const amountIssue = issueAt(issues, groupKey, 'components', c.id, 'amount')
    return {
      id: c.id,
      name: (
        <CommitTextField
          id={focusIds.componentName(c.id)}
          size="small"
          fullWidth
          label={stacked ? 'Name' : undefined}
          value={c.name}
          error={nameIssue ? message(nameIssue) : null}
          slotProps={{ htmlInput: { 'aria-label': `Name, component ${index + 1}` } }}
          onCommit={(name) =>
            edit(c.id, 'Rename component', (draft) => {
              draft.name = normalizeName(name)
            })
          }
        />
      ),
      amount: (
        <NumberField
          kind="currency"
          size="small"
          fullWidth
          label={stacked ? 'Amount' : undefined}
          value={c.amount}
          error={amountIssue ? message(amountIssue) : null}
          slotProps={{ htmlInput: { 'aria-label': `Amount, ${row}` } }}
          onCommit={(amount) =>
            edit(c.id, 'Edit component amount', (draft) => {
              draft.amount = amount
            })
          }
        />
      ),
      paid: paidBy ? (
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
      ) : null,
      remove: stacked ? (
        <Button
          id={focusIds.removeComponent(c.id)}
          aria-label={`Remove ${row}`}
          startIcon={<DeleteOutlined />}
          disabled={readOnly}
          onClick={() => remove(c.id)}
        >
          Remove
        </Button>
      ) : (
        <IconButton
          id={focusIds.removeComponent(c.id)}
          aria-label={`Remove ${row}`}
          disabled={readOnly}
          onClick={() => remove(c.id)}
        >
          <DeleteOutlined />
        </IconButton>
      ),
    }
  })

  const totals = componentTotals(set[groupKey], minorUnits(currency))
  const amount = (x: DecimalString | null) => (x === null ? '—' : <AccountingAmount value={D(x)} />)
  const layout: ComponentsLayoutProps = {
    groupKey,
    paidBy,
    rows,
    addButton: (
      <Button id={focusIds.addComponent(groupKey)} startIcon={<AddOutlined />} disabled={readOnly} onClick={add}>
        Add component
      </Button>
    ),
    totals: [
      { term: `Total ${GROUP_LABELS[groupKey].toLowerCase()}`, value: amount(totals.total) },
      ...(paidBy ? [{ term: paidBy, value: amount(totals.paid) }] : []),
    ],
  }

  return <Box ref={ref}>{stacked ? <ComponentsStack {...layout} /> : <ComponentsTable {...layout} />}</Box>
}
