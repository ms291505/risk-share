import AddOutlined from '@mui/icons-material/AddOutlined'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useRef, useState } from 'react'
import { Navigate, Link as RouterLink, useNavigate, useParams } from 'react-router'
import type { AmountSet } from '../../calc'
import { useAnnounce } from '../../app/announcer'
import { deleteAmountSet, deleteImpact, duplicateAmountSet, newAmountSet } from '../../state/amountSets'
import { useWorkspaceStore } from '../../state/store'
import { Page } from '../Page'
import { AmountSetEditor } from './AmountSetEditor'
import { AmountSetList } from './AmountSetList'
import { DeleteAmountSetDialog, type DeleteTarget } from './DeleteAmountSetDialog'
import { focusById, focusIds } from './focus'
import { amountSetPath } from './updateAmountSet'

const store = useWorkspaceStore

/** Amount sets (§4): a list beside the editor of the one in the URL. */
export function AmountSetsPage() {
  const { amountSetId } = useParams()
  const sets = useWorkspaceStore((s) => s.workspace.amountSets)
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  const compact = useMediaQuery(useTheme().breakpoints.down('md'))
  const navigate = useNavigate()
  const announce = useAnnounce()
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  /** Held until the dialog has closed: while it's open, the live region is hidden from screen readers. */
  const announceAfterClose = useRef<string | null>(null)

  if (amountSetId === undefined && sets.length > 0) return <Navigate replace to={amountSetPath(sets[0].id)} />
  const selected = sets.find((s) => s.id === amountSetId)

  /** Opens a set that was just added, ready to name it. */
  function openNew(set: AmountSet) {
    navigate(amountSetPath(set.id), { flushSync: true })
    focusById(focusIds.name)
  }

  function create() {
    const set = newAmountSet(sets)
    store.getState().update('Add amount set', (w) => {
      w.amountSets.push(set)
    })
    openNew(set)
  }

  function duplicate(original: AmountSet) {
    const copy = duplicateAmountSet(original)
    store.getState().update('Duplicate amount set', (w) => {
      w.amountSets.splice(w.amountSets.findIndex((s) => s.id === original.id) + 1, 0, copy)
    })
    openNew(copy)
  }

  function confirmDelete() {
    if (!deleting) return
    const { set, impact } = deleting
    setDeleting(null)
    // Another tab may have become the editor while the dialog was open.
    if (store.getState().readOnly) return
    const index = sets.findIndex((s) => s.id === set.id)
    store.getState().update('Delete amount set', (w) => deleteAmountSet(w, set.id))
    const remaining = store.getState().workspace.amountSets
    const next = remaining[Math.min(index, remaining.length - 1)]
    navigate(next ? amountSetPath(next.id) : '/amounts', { replace: true })
    const n = impact.scenarios.length
    announceAfterClose.current =
      n === 0 ? `Deleted ${set.name}.` : `Deleted ${set.name} and ${n} ${n === 1 ? 'scenario' : 'scenarios'}.`
  }

  function afterDeleteDialog() {
    const message = announceAfterClose.current
    if (message === null) return
    announceAfterClose.current = null
    // The Delete button that opened the dialog went away with the set.
    const current = document.querySelector<HTMLElement>(`#${focusIds.list} [aria-current="page"]`)
    if (current) current.focus()
    else focusById(sets.length > 0 ? focusIds.list : focusIds.newAmountSet)
    announce(message)
  }

  const newButton = (
    <Button
      id={focusIds.newAmountSet}
      variant="contained"
      startIcon={<AddOutlined />}
      disabled={readOnly}
      onClick={create}
    >
      New amount set
    </Button>
  )

  return (
    <Page title="Amount sets">
      {sets.length === 0 && amountSetId === undefined ? (
        <Stack spacing={2} sx={{ alignItems: 'flex-start', maxWidth: 560 }}>
          <Typography>
            An amount set is a named collection of additions and deductions, such as a year's actuals or a forecast.
            Scenarios and sensitivity sweeps use them.
          </Typography>
          {newButton}
        </Stack>
      ) : (
        <Stack direction={compact ? 'column' : 'row'} spacing={3} sx={{ width: '100%', alignItems: 'flex-start' }}>
          <Stack spacing={1} sx={{ width: compact ? '100%' : 260, flexShrink: 0, alignItems: 'flex-start' }}>
            {newButton}
            <AmountSetList sets={sets} selectedId={amountSetId} compact={compact} />
          </Stack>
          {selected ? (
            <AmountSetEditor
              key={selected.id}
              set={selected}
              onDuplicate={() => duplicate(selected)}
              onDelete={() =>
                setDeleting({ set: selected, impact: deleteImpact(store.getState().workspace, selected.id) })
              }
            />
          ) : (
            <Alert severity="info">
              This amount set no longer exists.{' '}
              <Link component={RouterLink} to="/amounts">
                Show amount sets
              </Link>
            </Alert>
          )}
        </Stack>
      )}
      <DeleteAmountSetDialog
        target={deleting}
        onDelete={confirmDelete}
        onCancel={() => setDeleting(null)}
        onExited={afterDeleteDialog}
      />
    </Page>
  )
}
