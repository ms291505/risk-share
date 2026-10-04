import { useColorScheme, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

export interface ChartTheme {
  text: string
  grid: string
  line: string
  reference: string
  corridor: string
  tooltipBackground: string
  /** For the net position per party chart (§10.3). */
  riskBearer: string
  counterparty: string
  fontFamily: string
  /** False under prefers-reduced-motion (§13.5). */
  animate: boolean
}

/**
 * Concrete colors for the active color scheme. Recharts sets colors as SVG
 * attributes, which can't use the theme's CSS variables, and exported SVGs
 * need real values anyway.
 */
export function useChartTheme(): ChartTheme {
  const theme = useTheme()
  const { colorScheme } = useColorScheme()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  // colorScheme can be undefined before MUI resolves the mode; fall back to the system setting.
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true })
  const scheme = colorScheme ?? (prefersDark ? 'dark' : 'light')
  const palette = theme.colorSchemes[scheme]?.palette ?? theme.palette
  return {
    text: palette.text.secondary,
    grid: palette.divider,
    line: palette.primary.main,
    reference: palette.text.primary,
    corridor: palette.action.selected,
    tooltipBackground: palette.background.paper,
    riskBearer: palette.party.riskBearer,
    counterparty: palette.party.counterparty,
    fontFamily: theme.typography.fontFamily ?? 'sans-serif',
    animate: !reducedMotion,
  }
}
