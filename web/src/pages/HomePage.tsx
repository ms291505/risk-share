import { Navigate } from 'react-router'
import { useWorkspaceStore } from '../state/store'
import { isEmptyWorkspace } from '../state/workspace'
import { WelcomePage } from './WelcomePage'

/** An empty workspace lands on the welcome view; otherwise on Scenarios (§1.7). */
export function HomePage() {
  const empty = useWorkspaceStore((s) => isEmptyWorkspace(s.workspace))
  return empty ? <WelcomePage /> : <Navigate to="/scenarios" replace />
}
