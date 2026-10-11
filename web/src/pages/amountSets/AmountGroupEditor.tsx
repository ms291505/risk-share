import CallSplitOutlined from '@mui/icons-material/CallSplitOutlined'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { current } from 'immer'
import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { minorUnits, type AmountSet, type Issue } from '../../calc'
import { NumberField } from '../../components/NumberField'
import { partyName } from '../../format/parties'
import { useIssueMessage } from '../../format/useIssueMessage'
import { componentTotals, replaceComponentsWithTotal, splitIntoComponents, type GroupKey } from '../../state/amountSets'
import { useWorkspaceStore } from '../../state/store'
import { ComponentsTable } from './ComponentsTable'
import { focusById, focusIds } from './focus'
import { GROUP_LABELS, issueAt } from './labels'
import { currentAmountSet, updateAmountSet, updateGroup } from './updateAmountSet'
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
  const sectionIssue = issueAt(issues, groupKey)

  const split = () => {
    const undoLabel = `Split ${lower} into components`
    flushSync(() => updateAmountSet(set.id, undoLabel, (s) => splitIntoComponents(current(s), groupKey)))
    const created = currentAmountSet(set.id)?.[groupKey].components[0]
    if (created) focusById(focusIds.componentName(created.id))
  }

  const askToUseTotal = () => {
    const anyMarked = groupKey === 'additions' && group.components.some((c) => c.paidByCounterparty)
    setTotalPreview({
      ...componentTotals(group, minor),
      groupKey,
      count: group.components.length,
      paidBy: anyMarked ? partyName(parties, 'counterparty') : null,
    })
  }

  const replaceWithTotal = () => {
    setTotalPreview(null)
    updateAmountSet(set.id, `Use a total for ${lower}`, (s) => replaceComponentsWithTotal(current(s), groupKey, minor))
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
        <TotalField set={set} groupKey={groupKey} issues={issues} />
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

function TotalField({ set, groupKey, issues }: Props) {
  const message = useIssueMessage()
  const label = `Total ${GROUP_LABELS[groupKey].toLowerCase()}`
  const issue = issueAt(issues, groupKey, 'total')
  return (
    <NumberField
      id={focusIds.total(groupKey)}
      kind="currency"
      label={label}
      value={set[groupKey].total}
      // Total additions must be positive (§4.5).
      decimalKeypad={groupKey === 'additions'}
      error={issue ? message(issue) : null}
      onCommit={(total) =>
        updateGroup(set.id, groupKey, `Edit ${label.toLowerCase()}`, (g) => {
          g.total = total
        })
      }
      sx={{ maxWidth: 360 }}
    />
  )
}
