import Box from '@mui/material/Box'
import type Big from 'big.js'
import { useFormatters } from '../format/useFormatters'

/**
 * A currency amount accounting style, with a negative in parentheses (§4.8).
 * The closing parenthesis hangs past the end, so in a right-aligned column
 * the digits line up with the positive amounts around it.
 */
export function AccountingAmount({ value }: { value: Big }) {
  const f = useFormatters()
  if (!value.lt(0)) return f.currency(value)
  return (
    <Box component="span" sx={{ position: 'relative' }}>
      ({f.unsignedCurrency(value)}
      <Box component="span" sx={{ position: 'absolute', left: '100%' }}>
        )
      </Box>
    </Box>
  )
}
