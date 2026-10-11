import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useId } from 'react'
import { D, type DecimalString } from '../../calc'
import { useLastNonNull } from '../../components/useLastNonNull'
import { useFormatters } from '../../format/useFormatters'
import type { ComponentTotals, GroupKey } from '../../state/amountSets'
import { GROUP_LABELS } from './labels'

/** What replacing the components will do, worked out when the dialog opens. */
export interface UseTotalPreview extends ComponentTotals {
  groupKey: GroupKey
  count: number
  /** The counterparty, if some components are marked as paid by it. */
  paidBy: string | null
}

interface Props {
  /** The dialog is closed while null. */
  preview: UseTotalPreview | null
  onConfirm(): void
  onCancel(): void
  /** After the closing transition, when focus can move to the new total. */
  onExited(): void
}

/** Confirms going back from components to a total, which removes the components (§4.3). */
export function UseTotalDialog({ preview, onConfirm, onCancel, onExited }: Props) {
  const shown = useLastNonNull(preview)
  const f = useFormatters()
  const titleId = useId()
  const textId = useId()
  const money = (x: DecimalString) => f.accountingCurrency(D(x))
  const group = shown && GROUP_LABELS[shown.groupKey].toLowerCase()

  let text = ''
  if (shown) {
    const components =
      shown.count === 1 ? 'the component' : shown.count === 2 ? 'both components' : `all ${shown.count} components`
    text =
      shown.total === null
        ? `Remove ${components} and enter a total instead? Some amounts can't be read, so the total starts blank.`
        : `Remove ${components} and use a total of ${money(shown.total)} instead?`
    if (shown.paidBy) {
      const paid = shown.paid === null ? 'The amount' : `The ${money(shown.paid)}`
      text += ` ${paid} marked as paid by ${shown.paidBy} won't be kept: only components record it.`
    }
    text += ' You can undo this.'
  }

  return (
    <Dialog
      open={preview !== null}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={textId}
      slotProps={{ transition: { onExited } }}
    >
      <DialogTitle id={titleId}>Use a total for {group}?</DialogTitle>
      <DialogContent>
        <DialogContentText id={textId}>{text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>
          Use a total
        </Button>
      </DialogActions>
    </Dialog>
  )
}
