import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { AnnouncerProvider } from './AnnouncerProvider'
import { MODE_STORAGE_KEY, theme } from './theme'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme} defaultMode="system" modeStorageKey={MODE_STORAGE_KEY} noSsr>
      <CssBaseline />
      <AnnouncerProvider>{children}</AnnouncerProvider>
    </ThemeProvider>
  )
}
