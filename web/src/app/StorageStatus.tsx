import SaveOutlined from '@mui/icons-material/SaveOutlined'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useId, useRef, useState } from 'react'
import { loadErrorMessage } from '../format/loadErrors'
import type { LoadError } from '../io/parse'
import { persistence, usePersistence, type StorageStatus } from '../io/persistence'
import { downloadText, workspaceFileName } from '../io/serialize'
import { useWorkspaceStore } from '../state/store'
import { useAnnounce } from './announcer'
import { useExportWorkspace } from './useExportWorkspace'

const LABELS: Record<StorageStatus, string> = {
  ok: 'Saved in this browser',
  full: 'Not saved: storage full',
  unavailable: 'Not saved',
  blocked: 'Not saved',
}

const KEEP_IT =
  "Browser storage isn't permanent: clearing browsing data, or a browser's automatic cleanup, erases it. " +
  'To keep a workspace for the long term, or to use it on another device, export it to a file.'

function downloadBackup() {
  const text = persistence()?.readBackup()
  if (text) downloadText(text, workspaceFileName('backup'))
}

function downloadSavedCopy() {
  const text = persistence()?.readStored()
  if (text) downloadText(text, workspaceFileName('saved'))
}

/**
 * App bar button showing where the workspace is saved (§11.1). Its popover
 * explains that browser storage is temporary and that exporting keeps a copy.
 */
export function StorageStatusButton({ compact }: { compact: boolean }) {
  const { status, hasBackup } = usePersistence()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const exportWorkspace = useExportWorkspace()
  const [exportedAs, setExportedAs] = useState<string | null>(null)
  const popoverId = useId()
  const headingId = useId()
  const label = LABELS[status]
  const icon = status === 'ok' ? <SaveOutlined /> : <WarningAmberOutlined />
  const buttonProps = {
    color: 'inherit',
    'aria-haspopup': 'dialog',
    'aria-expanded': anchor !== null,
    'aria-controls': anchor ? popoverId : undefined,
    onClick: (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget),
  } as const

  return (
    <>
      {compact ? (
        <Tooltip title={label}>
          <IconButton {...buttonProps} aria-label={label}>
            {icon}
          </IconButton>
        </Tooltip>
      ) : (
        <Button {...buttonProps} startIcon={icon} sx={{ textTransform: 'none' }}>
          {label}
        </Button>
      )}
      <Popover
        id={popoverId}
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        slotProps={{
          paper: { role: 'dialog', 'aria-labelledby': headingId, sx: { p: 2, maxWidth: 380 } },
          transition: { onExited: () => setExportedAs(null) },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Stack spacing={1.5}>
          <Typography id={headingId} variant="subtitle1" component="h2">
            {label}
          </Typography>
          <Typography variant="body2">
            {status === 'ok'
              ? 'Every change is saved on this device, in this browser. Nothing is sent anywhere.'
              : 'Your changes are only in this tab until you export them.'}
          </Typography>
          <Typography variant="body2">{KEEP_IT}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button variant="contained" size="small" onClick={() => setExportedAs(exportWorkspace())}>
              Export workspace
            </Button>
            {hasBackup && (
              <Button size="small" onClick={downloadBackup}>
                Download pre-update backup
              </Button>
            )}
          </Stack>
          {/* The popover hides the app's live region, so it confirms the export itself. */}
          <Typography role="status" variant="body2" sx={{ minHeight: '1.5em' }}>
            {exportedAs && `Exported to ${exportedAs}.`}
          </Typography>
        </Stack>
      </Popover>
    </>
  )
}

/** A persistent warning while changes aren't being saved (§11.1). */
export function StorageAlert() {
  const { status, blockedBy } = usePersistence()
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      {status === 'blocked' && blockedBy ? (
        <BlockedAlert reason={blockedBy} onReplace={() => setConfirming(true)} />
      ) : (
        <NotSavingAlert status={status} />
      )}
      {/* Outside the alert, which disappears as soon as the saved copy is replaced. */}
      <ReplaceSavedCopyDialog open={confirming} onClose={() => setConfirming(false)} />
    </>
  )
}

function NotSavingAlert({ status }: { status: StorageStatus }) {
  const exportWorkspace = useExportWorkspace()
  const exportAction = (
    <Button color="inherit" size="small" onClick={() => void exportWorkspace()}>
      Export
    </Button>
  )
  if (status === 'full') {
    return (
      <Alert severity="warning" sx={{ mb: 2 }} action={exportAction}>
        Browser storage is full, so changes aren't being saved. Export the workspace to a file to keep them.
      </Alert>
    )
  }
  if (status === 'unavailable') {
    return (
      <Alert severity="warning" sx={{ mb: 2 }} action={exportAction}>
        This browser isn't letting Risk Share save, so changes will be lost when you close this tab. Export the
        workspace to a file to keep them.
      </Alert>
    )
  }
  return null
}

function BlockedAlert({ reason, onReplace }: { reason: LoadError; onReplace(): void }) {
  // Only the editor tab may write (§11.1).
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const message = loadErrorMessage(reason)
  return (
    <Alert severity="error" sx={{ mb: 2 }}>
      <AlertTitle>The workspace saved in this browser can't be opened</AlertTitle>
      <Typography variant="body2">{message.title}</Typography>
      {message.details.map((d, i) => (
        <Typography key={i} variant="body2">
          {d}
        </Typography>
      ))}
      <Typography variant="body2" sx={{ mt: 1 }}>
        To keep the saved copy safe, changes made here aren't saved.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
        <Button color="inherit" size="small" variant="outlined" onClick={downloadSavedCopy}>
          Download saved copy
        </Button>
        {!readOnly && (
          <Button color="inherit" size="small" onClick={onReplace}>
            Replace saved copy…
          </Button>
        )}
      </Stack>
    </Alert>
  )
}

function ReplaceSavedCopyDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const titleId = useId()
  const announce = useAnnounce()
  const replaced = useRef(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{
        transition: {
          onExited: () => {
            if (!replaced.current) return
            replaced.current = false
            // The button that opened this dialog went away with the alert.
            document.querySelector<HTMLElement>('main h1')?.focus()
            announce('Replaced the saved workspace. Changes are being saved again.')
          },
        },
      }}
    >
      <DialogTitle id={titleId}>Replace the saved workspace?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The workspace saved in this browser will be overwritten by the one open here, and changes will be saved again.
          This can't be undone, so download the saved copy first if you might need it.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={downloadSavedCopy} sx={{ mr: 'auto' }}>
          Download saved copy
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => {
            persistence()?.overwriteBlocked()
            replaced.current = usePersistence.getState().status === 'ok'
            onClose()
          }}
        >
          Replace
        </Button>
      </DialogActions>
    </Dialog>
  )
}
