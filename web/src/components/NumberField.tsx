import InputAdornment from '@mui/material/InputAdornment'
import { useId } from 'react'
import { minorUnits, type DecimalString } from '../calc'
import { useIssueMessage } from '../format/useIssueMessage'
import { currencyAffix, formatNumberInput, parseNumberInput } from '../format/numberInput'
import { useWorkspaceStore } from '../state/store'
import { CommitTextField, type CommitTextFieldProps, type ParseResult } from './CommitTextField'

export interface NumberFieldProps extends Omit<CommitTextFieldProps, 'value' | 'onCommit' | 'parse'> {
  value: DecimalString | ''
  onCommit(value: DecimalString | ''): void
  /** Currency amounts show the workspace currency and its minor unit; percentages show "%". */
  kind: 'currency' | 'percent'
  /**
   * Shows the decimal keypad on touch devices. It has no minus key, so use
   * it only where a negative is never valid. Doesn't change what's accepted.
   */
  decimalKeypad?: boolean
}

/**
 * A number in the workspace locale (§2.4), committed like any text field
 * (§12.5). Text that can't be read stays in the field with an inline error
 * and isn't saved; Escape shows the saved value again.
 */
export function NumberField({ value, onCommit, kind, decimalKeypad = false, slotProps, ...props }: NumberFieldProps) {
  const { locale, currency } = useWorkspaceStore((s) => s.workspace.settings)
  const message = useIssueMessage()
  const unitId = useId()

  const isCurrency = kind === 'currency'
  const format = (v: string) =>
    formatNumberInput(v, { locale, minFractionDigits: isCurrency ? minorUnits(currency) : 0 })
  const parse = (text: string): ParseResult => {
    const parsed = parseNumberInput(text, isCurrency ? { locale, currency } : { locale, percent: true })
    return parsed.ok ? parsed : { ok: false, error: message(parsed.issue) }
  }
  const affix = isCurrency ? currencyAffix(locale, currency) : { symbol: '%', position: 'end' as const }
  const unitName = isCurrency ? new Intl.DisplayNames([locale], { type: 'currency' }).of(currency) : 'percent'
  const adornment = (
    <InputAdornment position={affix.position}>
      <span aria-hidden>{affix.symbol}</span>
      <span id={unitId} hidden>
        {unitName}
      </span>
    </InputAdornment>
  )

  return (
    <CommitTextField
      {...props}
      value={format(value)}
      describedBy={unitId}
      parse={parse}
      // "1000" and "1,000.00" are the same amount; don't add an undo step for it.
      onCommit={(v) => {
        if (format(v) !== format(value)) onCommit(v)
      }}
      slotProps={{
        ...slotProps,
        input: { ...slotProps?.input, [`${affix.position}Adornment`]: adornment },
        htmlInput: {
          ...slotProps?.htmlInput,
          inputMode: decimalKeypad ? 'decimal' : undefined,
          // Right-aligned, so amounts in a column line up by digit.
          style: { textAlign: 'right' },
        },
      }}
    />
  )
}
