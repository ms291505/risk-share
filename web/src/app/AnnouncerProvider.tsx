import Box from '@mui/material/Box'
import { useCallback, useState, type ReactNode } from 'react'
import { AnnouncerContext } from './announcer'
import { visuallyHidden } from './visuallyHidden'

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  // The key re-mounts the text so repeating the same message is announced again.
  const [message, setMessage] = useState({ text: '', key: 0 })
  const announce = useCallback((text: string) => setMessage((m) => ({ text, key: m.key + 1 })), [])
  return (
    <AnnouncerContext value={announce}>
      {children}
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        <span key={message.key}>{message.text}</span>
      </Box>
    </AnnouncerContext>
  )
}
