import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { evaluateAmountSet, minorUnits, type AmountSet } from '../../calc'
import { gainOrLoss, type Formatters } from '../../format/formatters'
import { useFormatters } from '../../format/useFormatters'
import { useWorkspaceStore } from '../../state/store'
import { focusIds } from './focus'
import { amountSetPath } from './paths'

interface Props {
  sets: AmountSet[]
  selectedId: string | undefined
  /** Below `md` the list becomes a select above the editor, to leave it the width (§1.5). */
  compact: boolean
}

/** Each set with its gain or loss, or "Needs attention" when it's invalid (§4.7). */
export function AmountSetList({ sets, selectedId, compact }: Props) {
  const currency = useWorkspaceStore((s) => s.workspace.settings.currency)
  const f = useFormatters()
  const navigate = useNavigate()
  const statuses = useMemo(() => {
    const minor = minorUnits(currency)
    return new Map(sets.map((set) => [set.id, status(set, minor, f)]))
  }, [sets, currency, f])

  if (compact) {
    // Names only, so the closed field isn't cut off mid-status; invalid sets are still marked.
    const index = sets.findIndex((s) => s.id === selectedId)
    return (
      <TextField
        select
        id={focusIds.list}
        label="Switch amount set"
        value={index < 0 ? '' : selectedId}
        helperText={index < 0 ? `${sets.length} amount sets` : `${index + 1} of ${sets.length}`}
        onChange={(e) => navigate(amountSetPath(e.target.value))}
        slotProps={{ select: { native: true } }}
        fullWidth
      >
        {index < 0 && <option value="" disabled />}
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {statuses.get(set.id)!.ok ? set.name : `${set.name} (needs attention)`}
          </option>
        ))}
      </TextField>
    )
  }

  return (
    <List id={focusIds.list} aria-label="Amount sets" disablePadding sx={{ width: '100%' }}>
      {sets.map((set) => {
        const { ok, text } = statuses.get(set.id)!
        return (
          <ListItem key={set.id} disablePadding>
            <ListItemButton
              component={NavLink}
              to={amountSetPath(set.id)}
              sx={{ '&.active': { bgcolor: 'action.selected' } }}
            >
              <ListItemText
                primary={set.name}
                // Names are up to 80 characters, possibly without spaces.
                slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } } }}
                secondary={
                  !ok ? (
                    <Stack
                      component="span"
                      direction="row"
                      spacing={0.5}
                      sx={{ alignItems: 'center', color: 'warning.main' }}
                    >
                      <WarningAmberOutlined fontSize="inherit" />
                      <span>{text}</span>
                    </Stack>
                  ) : (
                    text
                  )
                }
              />
            </ListItemButton>
          </ListItem>
        )
      })}
    </List>
  )
}

function status(set: AmountSet, minor: number, f: Formatters): { ok: boolean; text: string } {
  const result = evaluateAmountSet(set, minor)
  return result.ok ? { ok: true, text: gainOrLoss(result.totals.gainLoss, f) } : { ok: false, text: 'Needs attention' }
}
