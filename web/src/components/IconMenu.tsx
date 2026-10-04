import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import Tooltip from '@mui/material/Tooltip'
import { useState, type ReactNode } from 'react'

interface IconMenuProps {
  /** Accessible name and tooltip. */
  label: string
  icon: ReactNode
  color?: IconButtonProps['color']
  /** Menu items; call `close` after an item's action. */
  children: (close: () => void) => ReactNode
}

/** An icon button that opens a menu. */
export function IconMenu({ label, icon, color, children }: IconMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)
  return (
    <>
      <Tooltip title={label}>
        <IconButton
          color={color}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={anchor !== null}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          {icon}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        {children(close)}
      </Menu>
    </>
  )
}
