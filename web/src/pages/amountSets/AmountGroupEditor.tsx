import CallSplitOutlined from '@mui/icons-material/CallSplitOutlined'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { minorUnits, type AmountSet, type Issue } from '../../calc'
import { NumberField } from '../../components/NumberField'
import { useIssueMessage } from '../../format/useIssueMessage'
import { componentTotals, replaceComponentsWithTotal, splitIntoComponents, type GroupKey } from '../../state/amountSets'
import { partyName } from '../../state/parties'
import { useWorkspaceStore } from '../../state/store'
import { ComponentsTable } from './ComponentsTable'
import { focusById, focusIds } from './focus'
import { GROUP_LABELS, issueAt, paidByLabel } from './labels'
import { updateAmountSet, updateGroup } from './updateAmountSet'
import { UseTotalDialog, type UseTotalPreview } from './UseTotalDialog'

interface Props {
  set: AmountSet
  groupKey: GroupKey
  /** From evaluating the set; shown on the fields they're about. */
  issues: Issue[]
}

/**
 * Additions or deductions, entered as a total or as components (§4.3).
 * Splitting a total into components is one click; going back removes the
 * components, so it asks first.
 */
export function AmountGroupEditor({ set, groupKey, issues }: Props) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const minor = minorUnits(useWorkspaceStore((s) => s.workspace.settings.currency))
  const message = useIssueMessage()
  const headingId = useId()
  const errorId = useId()
  const [totalPreview, setTotalPreview] = useState<UseTotalPreview | null>(null)
  const replaced = useRef(false)
  const group = set[groupKey]
  const label = GROUP_LABELS[groupKey]
  const lower = label.toLowerCase()
  // Components mode has no counterparty-paid field, so its range error goes on the section.
  const sectionIssue =
    issueAt(issues, groupKey) ??
    (group.mode === 'components' ? issueAt(issues, groupKey, 'paidByCounterparty') : undefined)

  const split = () => {
    const next = splitIntoComponents(set, groupKey, minor, partyName(parties, 'counterparty'))
    flushSync(() => updateAmountSet(set.id, `Split ${lower} into components`, () => next))
    focusById(focusIds.componentName(next[groupKey].components[0].id))
  }

  const askToUseTotal = () => {
    const anyMarked = groupKey === 'additions' && group.components.some((c) => c.paidByCounterparty)
    setTotalPreview({
      ...componentTotals(group, minor),
      group: lower,
      count: group.components.length,
      paidBy: anyMarked ? partyName(parties, 'counterparty') : null,
    })
  }

  const replaceWithTotal = () => {
    setTotalPreview(null)
    updateAmountSet(set.id, `Use a total for ${lower}`, () => replaceComponentsWithTotal(set, groupKey, minor))
    replaced.current = true
  }

  return (
    <Stack
      component="section"
      spacing={2}
      aria-labelledby={headingId}
      aria-describedby={sectionIssue ? errorId : undefined}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography id={headingId} variant="h6" component="h2">
          {label}
        </Typography>
        {group.mode === 'total' ? (
          <Button size="small" startIcon={<CallSplitOutlined />} disabled={readOnly} onClick={split}>
            Split into components
          </Button>
        ) : (
          <Button size="small" disabled={readOnly} onClick={askToUseTotal}>
            Use a total instead…
          </Button>
        )}
      </Stack>
      {sectionIssue && (
        <Typography id={errorId} variant="body2" color="error">
          {message(sectionIssue)}
        </Typography>
      )}
      {group.mode === 'total' ? (
        <TotalFields set={set} groupKey={groupKey} issues={issues} />
      ) : (
        <ComponentsTable set={set} groupKey={groupKey} issues={issues} />
      )}
      <UseTotalDialog
        preview={totalPreview}
        onConfirm={replaceWithTotal}
        onCancel={() => setTotalPreview(null)}
        onExited={() => {
          // The button that opened the dialog went away with the components.
          if (replaced.current) focusById(focusIds.total(groupKey))
          replaced.current = false
        }}
      />
    </Stack>
  )
}

function TotalFields({ set, groupKey, issues }: Props) {
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const message = useIssueMessage()
  const isAdditions = groupKey === 'additions'
  const label = `Total ${GROUP_LABELS[groupKey].toLowerCase()}`
  const totalIssue = issueAt(issues, groupKey, 'total')
  const paidIssue = issueAt(issues, 'additions', 'paidByCounterparty')
  return (
    <Stack spacing={2} sx={{ maxWidth: 360 }}>
      <NumberField
        id={focusIds.total(groupKey)}
        kind="currency"
        label={label}
        value={set[groupKey].total}
        // Total additions must be positive (§4.5).
        allowNegative={!isAdditions}
        error={totalIssue ? message(totalIssue) : null}
        onCommit={(total) =>
          updateGroup(set.id, groupKey, `Edit ${label.toLowerCase()}`, (g) => {
            g.total = total
          })
        }
      />
      {isAdditions && (
        <NumberField
          kind="currency"
          label={`${paidByLabel(parties)} (optional)`}
          value={set.additions.paidByCounterparty ?? ''}
          error={paidIssue ? message(paidIssue) : null}
          onCommit={(paid) =>
            updateAmountSet(set.id, `Edit amount paid by ${partyName(parties, 'counterparty')}`, (s) => {
              s.additions.paidByCounterparty = paid
            })
          }
        />
      )}
    </Stack>
  )
}
