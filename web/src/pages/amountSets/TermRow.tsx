import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/**
 * A term and its value in a `<dl>`, the value right-aligned. Where both don't
 * fit on one line, the value moves under the term. Terms wrap rather than
 * being cut off, so a long counterparty name is shown in full.
 */
export function TermRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3 }}>
      <Typography component="dt" sx={{ flex: '1 1 8em', minWidth: 0, overflowWrap: 'anywhere' }}>
        {term}
      </Typography>
      <Typography component="dd" sx={{ m: 0, ml: 'auto', textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </Typography>
    </Box>
  )
}
