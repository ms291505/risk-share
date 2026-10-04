import { createTheme } from '@mui/material/styles'

declare module '@mui/material/styles' {
  /** Types `theme.vars` and `theme.colorSchemes`, since the theme uses CSS variables. */
  interface CssThemeVariables {
    enabled: true
  }
  interface Palette {
    /** Party colors. Direction is never shown by color alone (§13.3). */
    party: { riskBearer: string; counterparty: string }
  }
  interface PaletteOptions {
    party?: { riskBearer: string; counterparty: string }
  }
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: { palette: { party: { riskBearer: '#1565c0', counterparty: '#b45309' } } },
    dark: { palette: { party: { riskBearer: '#90caf9', counterparty: '#fbbf24' } } },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
})
