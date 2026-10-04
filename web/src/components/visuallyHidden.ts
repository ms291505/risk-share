import type { SxProps } from '@mui/material/styles'

/** Hidden on screen but read by screen readers. */
export const visuallyHidden: SxProps = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
  p: 0,
  m: -1,
}
