import { isEmptyWorkspace, type Workspace } from '../state/workspace'

/** Where a workspace opens: the welcome view when empty, otherwise Scenarios (§1.7). */
export function landingPath(workspace: Workspace): string {
  return isEmptyWorkspace(workspace) ? '/' : '/scenarios'
}
