import TextField, { type TextFieldProps } from '@mui/material/TextField'
import { useState } from 'react'
import { useWorkspaceStore } from '../state/store'

export type ParseResult = { ok: true; value: string } | { ok: false; error: string }

export type CommitTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'onBlur' | 'error' | 'helperText'> & {
  value: string
  /** Called once per edit, when the field loses focus or Enter is pressed (§12.5). */
  onCommit(value: string): void
  /**
   * Turns the text into the value to commit. Text it can't read stays in the
   * field with the error, and nothing is committed.
   */
  parse?(text: string): ParseResult
  /** Inline error for the committed value; linked to the field for screen readers (§13.4). */
  error?: string | null
}

/**
 * A text field that edits a local draft and commits it as one undo step.
 * While focused, Cmd/Ctrl+Z is the browser's in-field undo (§12.2). Escape,
 * or a change to `value` from elsewhere (app undo, another tab), discards the
 * draft. Read-only while another tab is the editor (§11.1).
 */
export function CommitTextField({
  value,
  onCommit,
  parse,
  error,
  onKeyDown,
  slotProps,
  ...props
}: CommitTextFieldProps) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  // null when not editing, so external changes (e.g. app undo) show through.
  const [draft, setDraft] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [shownValue, setShownValue] = useState(value)
  const discard = () => {
    setDraft(null)
    setParseError(null)
  }
  if (value !== shownValue) {
    setShownValue(value)
    discard()
  }
  const commit = () => {
    if (draft === null) return
    const parsed = parse ? parse(draft) : { ok: true as const, value: draft }
    if (!parsed.ok) return setParseError(parsed.error)
    if (draft !== value) onCommit(parsed.value)
    discard()
  }
  const shownError = parseError ?? error
  return (
    <TextField
      {...props}
      slotProps={readOnly ? { ...slotProps, htmlInput: { ...slotProps?.htmlInput, readOnly: true } } : slotProps}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !props.multiline) commit()
        else if (e.key === 'Escape') discard()
        onKeyDown?.(e)
      }}
      error={Boolean(shownError)}
      helperText={shownError ?? undefined}
    />
  )
}
