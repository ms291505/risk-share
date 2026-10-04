import { createContext, useContext } from 'react'

export type Announce = (message: string) => void

export const AnnouncerContext = createContext<Announce>(() => {})

/** Announces a message through a polite live region without moving focus (§13.4). */
export function useAnnounce(): Announce {
  return useContext(AnnouncerContext)
}
