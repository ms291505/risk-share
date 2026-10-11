import type { SxProps } from '@mui/material/styles'

/** One line, cut off with an ellipsis; give the element a `title` with the full text. */
export const truncated: SxProps = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
