import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, type ReactNode } from 'react'

/**
 * Page heading plus content. Each route renders exactly one h1, and sets a
 * unique document title (§13.6). The shell focuses the h1 after navigation.
 */
export function Page({ title, children }: { title: string; children?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Risk Share`
  }, [title])
  return (
    <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
      <Typography
        variant="h4"
        component="h1"
        tabIndex={-1}
        sx={{ '&:focus:not(:focus-visible)': { outline: 'none' } }}
      >
        {title}
      </Typography>
      {children}
    </Stack>
  )
}
