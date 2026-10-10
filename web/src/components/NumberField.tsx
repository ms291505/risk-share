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
  /** iPad's decimal keypad has no minus key, so fields that take negatives use the full keyboard. */
  allowNegative?: boolean
}

/**
 * A number in the workspace locale (§2.4), committed like any text field
 * (§12.5). Text that can't be read stays in the field with an inline error
 * and isn't saved; Escape shows the saved value again.
 */
export function NumberField({
  value,
  onCommit,
  kind,
  allowNegative = false,
  id,
  slotProps,
  ...props
}: NumberFieldProps) {
  const { locale, currency } = useWorkspaceStore((s) => s.workspace.settings)
  const message = useIssueMessage()
  const autoId = useId()
  const fieldId = id ?? autoId
  const unitId = `${fieldId}-unit`

  const isCurrency = kind === 'currency'
  const format = (v: string) =>
    formatNumberInput(v, { locale, minFractionDigits: isCurrency ? minorUnits(currency) : 0 })
  const parse = (text: string): ParseResult => {
    const parsed = parseNumberInput(text, { locale, currency: isCurrency ? currency : undefined })
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
      id={fieldId}
      value={format(value)}
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
          inputMode: allowNegative ? undefined : 'decimal',
          // Right-aligned, so amounts in a column line up by digit.
          style: { textAlign: 'right' },
          // Replaces MUI's own description, so it names the helper text (the error) too.
          'aria-describedby': `${fieldId}-helper-text ${unitId}`,
        },
      }}
    />
  )
}
