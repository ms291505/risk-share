import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/** Page heading plus content. Each route renders exactly one h1. */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      {children}
    </Stack>
  )
}

export function ComingSoon({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary">{children}</Typography>
}
