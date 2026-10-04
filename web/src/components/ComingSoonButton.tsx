import Button, { type ButtonProps } from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'

/**
 * A button for a feature that isn't built yet. It stays focusable (via
 * aria-disabled rather than `disabled`) so keyboard users can reach the reason.
 */
export function ComingSoonButton({
  reason,
  sx,
  ...props
}: Omit<ButtonProps, 'onClick' | 'disabled'> & { reason: string }) {
  return (
    <Tooltip title={reason} describeChild>
      <Button
        {...props}
        aria-disabled="true"
        sx={[{ opacity: 0.6, cursor: 'not-allowed' }, ...(Array.isArray(sx) ? sx : [sx])]}
      />
    </Tooltip>
  )
}
