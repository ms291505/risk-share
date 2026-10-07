import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useId } from 'react'
import { loadErrorMessage, type ImportError } from '../format/loadErrors'

/** Explains why a file couldn't be imported (§11.2). */
export function ImportErrorDialog({ error, onClose }: { error: ImportError | null; onClose(): void }) {
  const titleId = useId()
  const message = error && loadErrorMessage(error)
  return (
    <Dialog open={error !== null} onClose={onClose} aria-labelledby={titleId} role="alertdialog">
      <DialogTitle id={titleId}>{message?.title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          {message && message.details.length === 1 ? (
            <p style={{ margin: 0 }}>{message.details[0]}</p>
          ) : (
            <ul style={{ margin: 0, paddingInlineStart: '1.25em' }}>
              {message?.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          <p style={{ marginBottom: 0 }}>Your workspace hasn't changed.</p>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose} autoFocus>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}
