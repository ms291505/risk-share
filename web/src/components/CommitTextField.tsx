import TextField, { type TextFieldProps } from '@mui/material/TextField'
import { useState } from 'react'
import { useWorkspaceStore } from '../state/store'

type CommitTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'onBlur' | 'error' | 'helperText'> & {
  value: string
  /** Called once per edit, when the field loses focus or Enter is pressed (§12.5). */
  onCommit(value: string): void
  /** Inline error for the committed value; linked to the field for screen readers (§13.4). */
  error?: string | null
}

/**
 * A text field that edits a local draft and commits it as one undo step.
 * While focused, Cmd/Ctrl+Z is the browser's in-field undo (§12.2). Escape
 * discards the draft. Read-only while another tab is the editor (§11.1).
 */
export function CommitTextField({ value, onCommit, error, onKeyDown, slotProps, ...props }: CommitTextFieldProps) {
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  // null when not editing, so external changes (e.g. app undo) show through.
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft)
    setDraft(null)
  }
  return (
    <TextField
      {...props}
      slotProps={readOnly ? { ...slotProps, htmlInput: { ...slotProps?.htmlInput, readOnly: true } } : slotProps}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !props.multiline) commit()
        else if (e.key === 'Escape') setDraft(null)
        onKeyDown?.(e)
      }}
      error={Boolean(error)}
      helperText={error ?? undefined}
    />
  )
}
