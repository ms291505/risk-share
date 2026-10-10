import { useCallback } from 'react'
import type { Issue } from '../calc'
import { useWorkspaceStore } from '../state/store'
import { issueMessage } from './issues'

/** `issueMessage` with the workspace's party names. */
export function useIssueMessage(): (issue: Issue) => string {
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  return useCallback((issue: Issue) => issueMessage(issue, parties), [parties])
}
