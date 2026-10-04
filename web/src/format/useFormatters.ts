import { useMemo } from 'react'
import { useWorkspaceStore } from '../state/store'
import { makeFormatters, type Formatters } from './formatters'

/** Formatters for the workspace currency and locale (§2.2). */
export function useFormatters(): Formatters {
  const { locale, currency } = useWorkspaceStore((s) => s.workspace.settings)
  return useMemo(() => makeFormatters(locale, currency), [locale, currency])
}
