import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import BrightnessMediumOutlined from '@mui/icons-material/BrightnessMediumOutlined'
import Check from '@mui/icons-material/Check'
import CompareArrowsOutlined from '@mui/icons-material/CompareArrowsOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import ImportExportOutlined from '@mui/icons-material/ImportExportOutlined'
import RedoOutlined from '@mui/icons-material/RedoOutlined'
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import UndoOutlined from '@mui/icons-material/UndoOutlined'
import Alert from '@mui/material/Alert'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import { useColorScheme, useTheme } from '@mui/material/styles'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigationType } from 'react-router'
import { ComingSoonButton } from '../components/ComingSoonButton'
import { IconMenu } from '../components/IconMenu'
import { isSupportedBrowser } from '../format/browserSupport'
import { downloadWorkspace } from '../io/serialize'
import { useWorkspaceStore } from '../state/store'
import { useUndoRedo } from './useUndoRedo'
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
  const undoRedo = useUndoRedo()
  // Registered here rather than in the buttons, so restyling the toolbar can't drop the shortcuts.
  useUndoShortcuts(undoRedo.undo, undoRedo.redo)
  useFocusHeadingOnNavigate()

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SkipLink />
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
            Risk Share
          </Typography>
          <UndoRedoButtons {...undoRedo} />
          <ComingSoonButton color="inherit" reason="Load a worked example and take a short tour (coming soon)">
            Show me
          </ComingSoonButton>
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
        <UnsupportedBrowserNotice />
        <Outlet />
      </Box>
    </Box>
  )
}

/**
 * Moves focus to the new view's h1 after navigation, so screen readers hear
 * the change (§13.6). A view is the first path segment: picking an item in a
 * master-detail view (/terms/:id) keeps focus in the list. Redirects (replace
 * navigations, such as / → /scenarios on load) aren't a move by the user.
 */
function useFocusHeadingOnNavigate() {
  const view = useLocation().pathname.split('/')[1]
  const navigationType = useNavigationType()
  const previous = useRef(view)
  useEffect(() => {
    if (view === previous.current) return
    previous.current = view
    if (navigationType !== 'REPLACE') document.querySelector<HTMLElement>('main h1')?.focus()
  }, [view, navigationType])
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

function UnsupportedBrowserNotice() {
  const [show, setShow] = useState(() => !isSupportedBrowser())
  if (!show) return null
  return (
    <Alert severity="warning" onClose={() => setShow(false)} sx={{ mb: 2 }}>
      This browser isn't supported, so some amounts may display incorrectly. Use a recent version of Chrome, Edge,
      Firefox or Safari.
    </Alert>
  )
}

function UndoRedoButtons(props: { undo(): void; redo(): void; canUndo: boolean; canRedo: boolean }) {
  return (
    <>
      <Tooltip title="Undo">
        <span>
          <IconButton color="inherit" aria-label="Undo" onClick={props.undo} disabled={!props.canUndo}>
            <UndoOutlined />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo">
        <span>
          <IconButton color="inherit" aria-label="Redo" onClick={props.redo} disabled={!props.canRedo}>
            <RedoOutlined />
          </IconButton>
        </span>
      </Tooltip>
    </>
  )
}

function ImportExportMenu() {
  return (
    <IconMenu label="Import or export" icon={<ImportExportOutlined />} color="inherit">
      {(close) => [
        <MenuItem key="import" disabled>
          Import workspace… (coming soon)
        </MenuItem>,
        <MenuItem
          key="export"
          onClick={() => {
            downloadWorkspace(useWorkspaceStore.getState().workspace)
            close()
          }}
        >
          Export workspace
        </MenuItem>,
      ]}
    </IconMenu>
  )
}

const MODES = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
] as const

/** Per-browser setting, stored by MUI in localStorage and not exported (§1.8). */
function ColorSchemeMenu() {
  const { mode, setMode } = useColorScheme()
  return (
    <IconMenu label="Appearance" icon={<BrightnessMediumOutlined />} color="inherit">
      {(close) =>
        MODES.map((m) => (
          <MenuItem
            key={m.mode}
            role="menuitemradio"
            aria-checked={mode === m.mode}
            onClick={() => {
              setMode(m.mode)
              close()
            }}
          >
            <ListItemIcon>{mode === m.mode && <Check fontSize="small" />}</ListItemIcon>
            {m.label}
          </MenuItem>
        ))
      }
    </IconMenu>
  )
}
