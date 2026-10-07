import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import { useId, useState } from 'react'
import { describeContents } from '../format/workspaceContents'
import type { Workspace } from '../state/workspace'
import { useExportWorkspace } from './useExportWorkspace'

interface Props {
  /** The incoming workspace; the dialog is closed while null. */
  incoming: Workspace | null
  /** What it is, e.g. a file name. */
  source: string
  onReplace(): void
  onCancel(): void
  /** After the closing transition, when announcements can be heard again. */
  onExited?(): void
}

/**
 * Confirms replacing a non-empty workspace (import, "Show me"), offering to
 * export the current one first (§11.2). Replacing can be undone.
 */
export function ReplaceWorkspaceDialog({ incoming, source, onReplace, onCancel, onExited }: Props) {
  const exportWorkspace = useExportWorkspace()
  const [exportedAs, setExportedAs] = useState<string | null>(null)
  const titleId = useId()
  const textId = useId()
  return (
    <Dialog
      open={incoming !== null}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={textId}
      slotProps={{
        transition: {
          onExited: () => {
            setExportedAs(null)
            onExited?.()
          },
        },
      }}
    >
      <DialogTitle id={titleId}>Replace your workspace?</DialogTitle>
      <DialogContent>
        <DialogContentText id={textId}>
          {incoming &&
            `Everything in your workspace will be replaced by ${source} (${describeContents(incoming)}). You can undo this, or export your current workspace first to keep a copy.`}
        </DialogContentText>
        <Typography role="status" variant="body2" sx={{ mt: 1, minHeight: '1.5em' }}>
          {exportedAs && `Exported to ${exportedAs}.`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setExportedAs(exportWorkspace())} sx={{ mr: 'auto' }}>
          Export current first
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onReplace}>
          Replace
        </Button>
      </DialogActions>
    </Dialog>
  )
}
