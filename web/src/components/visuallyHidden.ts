import type { SxProps } from '@mui/material/styles'

/** Hidden on screen but read by screen readers. */
export const visuallyHidden: SxProps = {
  position: 'absolute',
  // Strings, because sx reads a bare 1 as 100% and spacing as theme units.
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
  p: 0,
  m: '-1px',
}
