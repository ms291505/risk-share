import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { NavLink, useNavigate } from 'react-router'
import { evaluateAmountSet, minorUnits, type AmountSet } from '../../calc'
import { gainOrLoss, type Formatters } from '../../format/formatters'
import { useFormatters } from '../../format/useFormatters'
import { useWorkspaceStore } from '../../state/store'
import { focusIds } from './focus'
import { amountSetPath } from './updateAmountSet'

const NEEDS_ATTENTION = 'Needs attention'

interface Props {
  sets: AmountSet[]
  selectedId: string | undefined
  /** Below `md` the list becomes a select, to leave room for the editor (§1.5). */
  compact: boolean
}

/** Each set with its gain or loss, or "Needs attention" when it's invalid (§4.7). */
export function AmountSetList({ sets, selectedId, compact }: Props) {
  const currency = useWorkspaceStore((s) => s.workspace.settings.currency)
  const f = useFormatters()
  const navigate = useNavigate()
  const status = (set: AmountSet) => statusText(set, minorUnits(currency), f)

  if (compact) {
    const selected = sets.some((s) => s.id === selectedId)
    return (
      <TextField
        select
        id={focusIds.list}
        label="Amount set"
        value={selected ? selectedId : ''}
        onChange={(e) => navigate(amountSetPath(e.target.value))}
        slotProps={{ select: { native: true } }}
        fullWidth
      >
        {!selected && <option value="" disabled />}
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {`${set.name} — ${status(set)}`}
          </option>
        ))}
      </TextField>
    )
  }

  return (
    <List id={focusIds.list} aria-label="Amount sets" disablePadding>
      {sets.map((set) => {
        const text = status(set)
        return (
          <ListItem key={set.id} disablePadding>
            <ListItemButton
              component={NavLink}
              to={amountSetPath(set.id)}
              sx={{ '&.active': { bgcolor: 'action.selected' } }}
            >
              <ListItemText
                primary={set.name}
                secondary={
                  text === NEEDS_ATTENTION ? (
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

function statusText(set: AmountSet, minor: number, f: Formatters): string {
  const result = evaluateAmountSet(set, minor)
  return result.ok ? gainOrLoss(result.totals.gainLoss, f) : NEEDS_ATTENTION
}
