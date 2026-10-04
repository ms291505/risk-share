import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/** Placeholder text for a view or section that isn't built yet. */
export function ComingSoon({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary">{children}</Typography>
}
