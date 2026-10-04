import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import BrightnessMediumOutlined from '@mui/icons-material/BrightnessMediumOutlined'
import CompareArrowsOutlined from '@mui/icons-material/CompareArrowsOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import ImportExportOutlined from '@mui/icons-material/ImportExportOutlined'
import RedoOutlined from '@mui/icons-material/RedoOutlined'
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import UndoOutlined from '@mui/icons-material/UndoOutlined'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useColorScheme, useTheme } from '@mui/material/styles'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useCallback, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { selectCanRedo, selectCanUndo, useWorkspaceStore } from '../state/store'
import { useAnnounce } from './announcer'
import { useUndoShortcuts } from './useUndoShortcuts'

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/workspace', label: 'Workspace', icon: <TuneOutlined /> },
  { to: '/amounts', label: 'Amount sets', icon: <AccountBalanceWalletOutlined /> },
  { to: '/terms', label: 'Terms', icon: <DescriptionOutlined /> },
  { to: '/scenarios', label: 'Scenarios', icon: <CompareArrowsOutlined /> },
  { to: '/sensitivity', label: 'Sensitivity', icon: <ShowChartOutlined /> },
]

const DRAWER_WIDTH = 220
const MINI_DRAWER_WIDTH = 64

export function AppShell() {
  const theme = useTheme()
  // Desktop first; on tablets the nav collapses to icons (§1.5).
  const compact = useMediaQuery(theme.breakpoints.down('md'))
  const drawerWidth = compact ? MINI_DRAWER_WIDTH : DRAWER_WIDTH

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SkipLink />
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
            Risk Share
          </Typography>
          <UndoRedoButtons />
          <Tooltip title="Load a worked example and take a short tour (coming soon)">
            <span>
              <Button color="inherit" disabled>
                Show me
              </Button>
            </span>
          </Tooltip>
          <ImportExportMenu />
          <ColorSchemeMenu />
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <nav aria-label="Main">
          <List>
            {NAV.map(({ to, label, icon }) => (
              <Tooltip key={to} title={compact ? label : ''} placement="right">
                <ListItemButton
                  component={NavLink}
                  to={to}
                  aria-label={compact ? label : undefined}
                  sx={{ '&.active': { bgcolor: 'action.selected' } }}
                >
                  <ListItemIcon>{icon}</ListItemIcon>
                  {!compact && <ListItemText primary={label} />}
                </ListItemButton>
              </Tooltip>
            ))}
          </List>
        </nav>
      </Drawer>
      <Box
        component="main"
        id="main"
        tabIndex={-1}
        sx={{ flexGrow: 1, minWidth: 0, p: 3, '&:focus': { outline: 'none' } }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}

/** Hash routing owns the URL fragment, so the skip link moves focus itself. */
function SkipLink() {
  return (
    <Box
      component="a"
      href="#main"
      onClick={(e) => {
        e.preventDefault()
        document.getElementById('main')?.focus()
      }}
      sx={{
        position: 'absolute',
        left: 8,
        top: -48,
        zIndex: (t) => t.zIndex.tooltip + 1,
        p: 1,
        bgcolor: 'background.paper',
        color: 'text.primary',
        '&:focus': { top: 8 },
      }}
    >
      Skip to content
    </Box>
  )
}

function UndoRedoButtons() {
  const canUndo = useWorkspaceStore(selectCanUndo)
  const canRedo = useWorkspaceStore(selectCanRedo)
  const announce = useAnnounce()
  const undo = useCallback(() => {
    const label = useWorkspaceStore.getState().undo()
    if (label) announce(`Undid: ${label}`)
  }, [announce])
  const redo = useCallback(() => {
    const label = useWorkspaceStore.getState().redo()
    if (label) announce(`Redid: ${label}`)
  }, [announce])
  useUndoShortcuts(undo, redo)

  return (
    <>
      <Tooltip title="Undo">
        <span>
          <IconButton color="inherit" aria-label="Undo" onClick={undo} disabled={!canUndo}>
            <UndoOutlined />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo">
        <span>
          <IconButton color="inherit" aria-label="Redo" onClick={redo} disabled={!canRedo}>
            <RedoOutlined />
          </IconButton>
        </span>
      </Tooltip>
    </>
  )
}

function ImportExportMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Tooltip title="Import / export">
        <IconButton
          color="inherit"
          aria-label="Import or export"
          aria-haspopup="menu"
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <ImportExportOutlined />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem disabled>Import workspace…</MenuItem>
        <MenuItem disabled>Export workspace</MenuItem>
      </Menu>
    </>
  )
}

const MODES = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
] as const

function ColorSchemeMenu() {
  const { mode, setMode } = useColorScheme()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Tooltip title="Appearance">
        <IconButton
          color="inherit"
          aria-label="Appearance"
          aria-haspopup="menu"
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <BrightnessMediumOutlined />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {MODES.map((m) => (
          <MenuItem
            key={m.mode}
            selected={mode === m.mode}
            onClick={() => {
              setMode(m.mode)
              setAnchor(null)
            }}
          >
            {m.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
