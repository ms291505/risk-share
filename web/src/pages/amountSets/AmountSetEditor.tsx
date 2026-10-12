import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useMemo } from 'react'
import { evaluateAmountSet, minorUnits, type AmountSet } from '../../calc'
import { CommitTextField } from '../../components/CommitTextField'
import { useIssueMessage } from '../../format/useIssueMessage'
import { nameIssues, normalizeName } from '../../state/names'
import { useWorkspaceStore } from '../../state/store'
import { AmountGroupEditor } from './AmountGroupEditor'
import { AmountSetSummary } from './AmountSetSummary'
import { focusIds } from './focus'
import { updateAmountSet } from './updateAmountSet'

interface Props {
  set: AmountSet
  onDuplicate(): void
  onDelete(): void
}

/**
 * One amount set (§4). Invalid values are saved and shown with inline errors
 * (§4.7); name problems don't make the set invalid for calculations.
 */
export function AmountSetEditor({ set, onDuplicate, onDelete }: Props) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const currency = useWorkspaceStore((s) => s.workspace.settings.currency)
  const result = useMemo(() => evaluateAmountSet(set, minorUnits(currency)), [set, currency])
  const issues = result.ok ? [] : result.issues
  const nameIssue = nameIssues(set.name, ['name'])[0]
  const message = useIssueMessage()

  return (
    <Stack spacing={4} sx={{ flexGrow: 1, minWidth: 0, maxWidth: 760 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <CommitTextField
          id={focusIds.name}
          label="Name"
          value={set.name}
          error={nameIssue ? message(nameIssue) : null}
          onCommit={(name) =>
            updateAmountSet(set.id, 'Rename amount set', (s) => {
              s.name = normalizeName(name)
            })
          }
          sx={{ flex: '1 1 240px', minWidth: 0 }}
        />
        <Button startIcon={<ContentCopyOutlined />} disabled={readOnly} onClick={onDuplicate} sx={{ mt: 1 }}>
          Duplicate
        </Button>
        <Button color="error" startIcon={<DeleteOutlined />} disabled={readOnly} onClick={onDelete} sx={{ mt: 1 }}>
          Delete…
        </Button>
      </Stack>
      <AmountGroupEditor set={set} groupKey="additions" issues={issues} />
      <AmountGroupEditor set={set} groupKey="deductions" issues={issues} />
      <AmountSetSummary set={set} result={result} />
    </Stack>
  )
}
