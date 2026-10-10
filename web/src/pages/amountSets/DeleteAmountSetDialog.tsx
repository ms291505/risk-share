import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import { useId } from 'react'
import type { AmountSet } from '../../calc'
import { useLastNonNull } from '../../components/useLastNonNull'
import type { DeleteImpact } from '../../state/amountSets'

/** Names listed before "and N more". */
const MAX_LISTED = 10

export interface DeleteTarget {
  set: AmountSet
  impact: DeleteImpact
}

interface Props {
  /** The dialog is closed while null. */
  target: DeleteTarget | null
  onDelete(): void
  onCancel(): void
  /** After the closing transition, when announcements can be heard again. */
  onExited(): void
}

/** Confirms deleting an amount set, listing the scenarios and sweeps it affects (§8.6). */
export function DeleteAmountSetDialog({ target, onDelete, onCancel, onExited }: Props) {
  const shown = useLastNonNull(target)
  const titleId = useId()
  const { scenarios = [], sweeps = [] } = shown?.impact ?? {}
  return (
    <Dialog
      open={target !== null}
      onClose={onCancel}
      aria-labelledby={titleId}
      slotProps={{ transition: { onExited } }}
    >
      <DialogTitle id={titleId}>Delete “{shown?.set.name}”?</DialogTitle>
      <DialogContent>
        {scenarios.length > 0 && (
          <>
            <DialogContentText>
              {scenarios.length === 1
                ? 'This scenario uses it and will be deleted too:'
                : `These ${scenarios.length} scenarios use it and will be deleted too:`}
            </DialogContentText>
            <NameList names={scenarios.map((s) => s.name)} />
          </>
        )}
        {sweeps.length > 0 && (
          <>
            <DialogContentText>
              {sweeps.length === 1
                ? 'This saved sweep uses it as the baseline. It will be kept, but needs a new baseline:'
                : `These ${sweeps.length} saved sweeps use it as the baseline. They will be kept, but need a new baseline:`}
            </DialogContentText>
            <NameList names={sweeps.map((s) => s.name)} />
          </>
        )}
        <DialogContentText>You can undo this.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onDelete}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function NameList({ names }: { names: string[] }) {
  const more = names.length - MAX_LISTED
  return (
    <Typography component="ul" variant="body2" sx={{ mt: 0.5, mb: 2 }}>
      {names.slice(0, MAX_LISTED).map((name, i) => (
        <li key={i}>{name}</li>
      ))}
      {more > 0 && <li>and {more} more</li>}
    </Typography>
  )
}
